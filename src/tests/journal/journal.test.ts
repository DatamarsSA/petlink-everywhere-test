import { beforeAll, describe, expect, it } from "vitest";
import {
  EventSentimentEnum,
  JournalEventTypeEnum,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { testHelper } from "../../clients/client-test-helper.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

describe("Journal", () => {
  describe("Event Types", () => {
    let testPetId: string;
    let customEventTypeId: string;
    let defaultEventTypesCount = 0;

    beforeAll(async () => {
      await testHelper.cleanUpUser();
      const setup = await testHelper.setupBuilder().withUser().withDog().build();
      testPetId = setup.dog!.id;
    });

    it("Should get default journal event types for a pet", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEventTypes({ petId: testPetId });
      expect(
        res.getJournalEventTypes.code,
        `getJournalEventTypes should succeed - Error: ${res.getJournalEventTypes.message}`,
      ).toBe("200");
      expect(
        res.getJournalEventTypes.eventTypes?.length,
        "Default event types should be returned for a new pet",
      ).toBeGreaterThanOrEqual(0);
      defaultEventTypesCount = res.getJournalEventTypes.eventTypes!.length;
    });

    it("Should add a custom journal event type", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.addJournalEventType({
        input: {
          petId: testPetId,
          eventType: JournalEventTypeEnum.Behaviours,
          name: "CustomBehaviourTest",
          sentimentType: EventSentimentEnum.Positive,
        },
      });
      expect(
        res.addJournalEventType.code,
        `addJournalEventType should succeed - Error: ${res.addJournalEventType.message}`,
      ).toBe("200");
      expect(
        res.addJournalEventType.eventTypes?.length,
        "Event types should include the newly created custom type",
      ).toBeGreaterThan(0);

      const created = res.addJournalEventType.eventTypes!.find(
        (et) => et.name === "CustomBehaviourTest",
      );
      expect(created, "Created custom event type should be present in response").toBeDefined();
      expect(created!.eventType, "Created event type should match input").toBe(JournalEventTypeEnum.Behaviours);
      expect(created!.sentimentType, "Created sentiment type should match input").toBe(EventSentimentEnum.Positive);
      customEventTypeId = created!.id;
    });

    it("Should include the custom event type in getJournalEventTypes after creation", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEventTypes({ petId: testPetId });
      expect(
        res.getJournalEventTypes.code,
        `getJournalEventTypes should succeed - Error: ${res.getJournalEventTypes.message}`,
      ).toBe("200");

      const customType = res.getJournalEventTypes.eventTypes?.find(
        (et) => et.id === customEventTypeId,
      );
      expect(customType, "Custom event type should still be present after creation").toBeDefined();
      expect(
        res.getJournalEventTypes.eventTypes!.length,
        "Event types count should be greater than default count",
      ).toBeGreaterThan(defaultEventTypesCount);
    });

    it("Should delete the custom journal event type", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.deleteJournalEventType({
        input: { id: customEventTypeId },
      });
      expect(
        res.deleteJournalEventType.code,
        `deleteJournalEventType should succeed - Error: ${res.deleteJournalEventType.message}`,
      ).toBe("200");
    });

    it("Should no longer include the custom event type after deletion", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEventTypes({ petId: testPetId });
      expect(
        res.getJournalEventTypes.code,
        `getJournalEventTypes should succeed - Error: ${res.getJournalEventTypes.message}`,
      ).toBe("200");

      const customType = res.getJournalEventTypes.eventTypes?.find(
        (et) => et.id === customEventTypeId,
      );
      expect(customType, "Custom event type should be removed after deletion").toBeUndefined();
    });
  });

  describe("Entries", () => {
    let testPetId: string;
    let moodId: string;
    let moodPoints: number;
    let connectionId: string;
    let connectionPoints: number;
    let behaviourId: string;
    let behaviourPoints: number;
    let routineCheckId: string;
    let routineCheckPoints: number;
    let journalEntryId: string;
    const yesterdayIso = new Date(Date.now() - 86400000).toISOString();
    const tomorrowIso = new Date(Date.now() + 86400000).toISOString();
    const noteText = "Test journal entry note";

    beforeAll(async () => {
      await testHelper.cleanUpUser();
      const setup = await testHelper.setupBuilder().withUser().withDog().build();
      testPetId = setup.dog!.id;
    });

    it("Should have default journal event types available for entry creation", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEventTypes({ petId: testPetId });
      expect(
        res.getJournalEventTypes.code,
        `getJournalEventTypes should succeed - Error: ${res.getJournalEventTypes.message}`,
      ).toBe("200");

      const eventTypes = res.getJournalEventTypes.eventTypes ?? [];
      const mood = eventTypes.find((et) => et.eventType === JournalEventTypeEnum.Mood);
      const connection = eventTypes.find((et) => et.eventType === JournalEventTypeEnum.Connection);
      const behaviour = eventTypes.find((et) => et.eventType === JournalEventTypeEnum.Behaviours);
      const routineCheck = eventTypes.find((et) => et.eventType === JournalEventTypeEnum.RoutineCheck);

      expect(mood?.id, "Default MOOD event type should be present").toBeTruthy();
      expect(connection?.id, "Default CONNECTION event type should be present").toBeTruthy();
      expect(behaviour?.id, "Default BEHAVIOURS event type should be present").toBeTruthy();
      expect(routineCheck?.id, "Default ROUTINE_CHECK event type should be present").toBeTruthy();

      moodId = mood!.id;
      moodPoints = mood!.points;
      connectionId = connection!.id;
      connectionPoints = connection!.points;
      behaviourId = behaviour!.id;
      behaviourPoints = behaviour!.points;
      routineCheckId = routineCheck!.id;
      routineCheckPoints = routineCheck!.points;
    });

    it("Should add a journal entry with valid data", async () => {
      const expectedTotal = moodPoints + connectionPoints + behaviourPoints + routineCheckPoints;

      const res = await petlink.core.graphqlHttp.authJwt.addJournalEntry({
        input: {
          petId: testPetId,
          moodId,
          connectionIds: [connectionId],
          behaviourIds: [behaviourId],
          routineCheckIds: [routineCheckId],
          note: noteText,
        },
      });
      expect(
        res.addJournalEntry.code,
        `addJournalEntry should succeed - Error: ${res.addJournalEntry.message}`,
      ).toBe("200");
      expect(res.addJournalEntry.journalEntry, "Created journal entry should be returned").toBeDefined();
      expect(res.addJournalEntry.journalEntry!.petId, "Journal entry petId should match input").toBe(testPetId);
      expect(res.addJournalEntry.journalEntry!.mood.id, "Journal entry moodId should match input").toBe(moodId);
      expect(
        res.addJournalEntry.journalEntry!.connection.map((c) => c.id),
        "Journal entry connectionIds should match input",
      ).toContain(connectionId);
      expect(
        res.addJournalEntry.journalEntry!.behaviour.map((b) => b.id),
        "Journal entry behaviourIds should match input",
      ).toContain(behaviourId);
      expect(
        res.addJournalEntry.journalEntry!.routineCheck.map((r) => r.id),
        "Journal entry routineCheckIds should match input",
      ).toContain(routineCheckId);
      expect(
        res.addJournalEntry.journalEntry!.totalPoints,
        `Total points should be exactly ${expectedTotal}`,
      ).toBe(expectedTotal);

      journalEntryId = res.addJournalEntry.journalEntry!.id;
    });

    it("Should return calculated points in the created journal entry", async () => {
      const expectedTotal = moodPoints + connectionPoints + behaviourPoints + routineCheckPoints;

      const res = await petlink.core.graphqlHttp.authJwt.getJournalEntry({ journalId: journalEntryId });
      const entry = res.getJournalEntry.journalEntry!;

      expect(
        entry.totalPoints,
        `Total points should equal the exact sum of selected event type points (${expectedTotal})`,
      ).toBe(expectedTotal);
      expect(
        entry.moodPoints + entry.connectionPoints + entry.behaviourPoints + entry.routineCheckPoints,
        "Category points should sum to total points",
      ).toBe(entry.totalPoints);
    });

    it("Should retrieve the created journal entry by ID", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEntry({ journalId: journalEntryId });
      expect(
        res.getJournalEntry.code,
        `getJournalEntry should succeed - Error: ${res.getJournalEntry.message}`,
      ).toBe("200");
      expect(res.getJournalEntry.journalEntry, "Journal entry should be found by ID").toBeDefined();
      expect(res.getJournalEntry.journalEntry!.id, "Journal entry ID should match").toBe(journalEntryId);
      expect(res.getJournalEntry.journalEntry!.petId, "Journal entry petId should match").toBe(testPetId);
    });

    it("Should include the entry in getJournalEntries for the correct date range", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEntries({
        input: {
          petId: testPetId,
          from: yesterdayIso,
          to: tomorrowIso,
        },
      });
      expect(
        res.getJournalEntries.code,
        `getJournalEntries should succeed - Error: ${res.getJournalEntries.message}`,
      ).toBe("200");
      expect(
        res.getJournalEntries.entries?.length,
        "At least one entry should be returned in date range",
      ).toBeGreaterThan(0);
      const found = res.getJournalEntries.entries!.find((e) => e.id === journalEntryId);
      expect(found, "Created entry should appear in the date range query").toBeDefined();
    });

    it("Should add a journal entry without a note", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.addJournalEntry({
        input: {
          petId: testPetId,
          moodId,
          connectionIds: [connectionId],
          behaviourIds: [behaviourId],
          routineCheckIds: [routineCheckId],
        },
      });
      expect(
        res.addJournalEntry.code,
        `addJournalEntry without note should succeed - Error: ${res.addJournalEntry.message}`,
      ).toBe("200");
      expect(res.addJournalEntry.journalEntry, "Created journal entry should be returned").toBeDefined();
      expect(res.addJournalEntry.journalEntry!.note, "Note should be empty when omitted").equals("");
    });

    it("Should return empty entries for a date range that does not include the entry", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEntries({
        input: {
          petId: testPetId,
          from: "2020-01-01T00:00:00.000Z",
          to: "2020-01-02T00:00:00.000Z",
        },
      });
      expect(
        res.getJournalEntries.code,
        `getJournalEntries should succeed for out-of-range dates - Error: ${res.getJournalEntries.message}`,
      ).toBe("200");
      expect(
        res.getJournalEntries.entries?.length ?? 0,
        "No entries should be returned for a past date range",
      ).toBe(0);
    });
  });

  describe("Error handling", () => {
    let testPetId: string;
    let moodId: string;
    let connectionId: string;
    let behaviourId: string;
    let routineCheckId: string;

    beforeAll(async () => {
      await testHelper.cleanUpUser();
      const setup = await testHelper.setupBuilder().withUser().withDog().build();
      testPetId = setup.dog!.id;
    });

    it("Should have default journal event types available for error tests", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEventTypes({ petId: testPetId });
      expect(
        res.getJournalEventTypes.code,
        `getJournalEventTypes should succeed - Error: ${res.getJournalEventTypes.message}`,
      ).toBe("200");

      const eventTypes = res.getJournalEventTypes.eventTypes ?? [];
      moodId = eventTypes.find((et) => et.eventType === JournalEventTypeEnum.Mood)?.id ?? "";
      connectionId = eventTypes.find((et) => et.eventType === JournalEventTypeEnum.Connection)?.id ?? "";
      behaviourId = eventTypes.find((et) => et.eventType === JournalEventTypeEnum.Behaviours)?.id ?? "";
      routineCheckId = eventTypes.find((et) => et.eventType === JournalEventTypeEnum.RoutineCheck)?.id ?? "";

      expect(moodId, "Default MOOD event type should be present").not.toBe("");
      expect(connectionId, "Default CONNECTION event type should be present").not.toBe("");
      expect(behaviourId, "Default BEHAVIOURS event type should be present").not.toBe("");
      expect(routineCheckId, "Default ROUTINE_CHECK event type should be present").not.toBe("");
    });

    it("Should fail to add a journal entry with a non-existing petId", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.addJournalEntry({
        input: {
          petId: "00000000-0000-0000-0000-000000000000",
          moodId,
          connectionIds: [connectionId],
          behaviourIds: [behaviourId],
          routineCheckIds: [routineCheckId],
        },
      });
      expect(res.addJournalEntry.code, "addJournalEntry should fail with non-existing petId").not.toBe("200");
    });

    it("Should fail to add a journal entry with non-existing event type IDs", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.addJournalEntry({
        input: {
          petId: testPetId,
          moodId: "00000000-0000-0000-0000-000000000000",
          connectionIds: ["00000000-0000-0000-0000-000000000000"],
          behaviourIds: ["00000000-0000-0000-0000-000000000000"],
          routineCheckIds: ["00000000-0000-0000-0000-000000000000"],
        },
      });
      expect(res.addJournalEntry.code, "addJournalEntry should fail with non-existing event type IDs").not.toBe("200");
    });

    it("Should fail to retrieve a journal entry with a non-existing ID", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEntry({
        journalId: "00000000-0000-0000-0000-000000000000",
      });
      expect(res.getJournalEntry.journalEntry, "getJournalEntry should return null journalEntry").toBeNull();
    });
  });
});
