import { gql } from "graphql-request";

export const onGpsMessagePosition = gql`
  subscription onGpsMessagePosition($id: String!) {
    onGpsMessagePosition(id: $id) {
      id
      messageType
      position {
        lat
        lng
        alt
        radius
        speed
        positionType
        date
      }
    }
  }
`;

export const onGpsMessageStatus = gql`
  subscription onGpsMessageStatus($id: String!) {
    onGpsMessageStatus(id: $id) {
      id
      messageType
      status {
        battery
        flashlight
        sound
        liveTracking
        geofence
        inGeofence
        energySavingMode
        inEnergySavingZone
        firmwareVersion
        date
      }
    }
  }
`;

export const onSubscriptionStatus = gql`
  subscription onSubscriptionStatus($id: String!) {
    onSubscriptionStatus(id: $id) {
      id
      status {
        productId
        subscriptionIsActive
        currentTermEnd
      }
    }
  }
`;
