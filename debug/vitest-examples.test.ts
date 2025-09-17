// src/debug/vitest-examples.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';

// Funzione di esempio da testare
function sum(a: number, b: number): number {
    return a + b;
}

// Funzione asincrona di esempio
async function fetchData(): Promise<string> {
    return new Promise(resolve => {
        setTimeout(() => resolve('data'), 100);
    });
}

// Classe di esempio
class Counter {
    private count = 0;

    increment(): void {
        this.count++;
    }

    getCount(): number {
        return this.count;
    }
}

// Suite di test principale
describe('Vitest Examples', () => {
    // Hook che viene eseguito una volta prima di tutti i test in questa suite
    beforeAll(() => {
        console.log('beforeAll - Eseguito una volta prima di tutti i test');
    });

    // Hook che viene eseguito prima di ogni test
    beforeEach(() => {
        console.log('beforeEach - Eseguito prima di ogni test');
    });

    // Hook che viene eseguito dopo ogni test
    afterEach(() => {
        console.log('afterEach - Eseguito dopo ogni test');
    });

    // Hook che viene eseguito una volta dopo tutti i test
    afterAll(() => {
        console.log('afterAll - Eseguito una volta dopo tutti i test');
    });

    // Test semplice
    it('should add two numbers correctly', () => {
        expect(sum(2, 3)).toBe(5);
    });

    // Test asincrono
    it('should handle async operations', async () => {
        const data = await fetchData();
        expect(data).toBe('data');
    });

    // Test con timeout personalizzato
    it('should respect custom timeouts', async () => {
        const data = await fetchData();
        expect(data).toBe('data');
    }, 1000); // timeout di 1 secondo

    // Nested describe per raggruppare test correlati
    describe('Counter class', () => {
        let counter: Counter;

        beforeEach(() => {
            counter = new Counter();
        });

        it('should start with count 0', () => {
            expect(counter.getCount()).toBe(0);
        });

        it('should increment the counter', () => {
            counter.increment();
            expect(counter.getCount()).toBe(1);

            counter.increment();
            expect(counter.getCount()).toBe(2);
        });
    });

    // Test con mock
    describe('Mocking examples', () => {
        it('should mock functions', () => {
            // Crea una funzione mock
            const mockFn = vi.fn();

            // Configura il comportamento del mock
            mockFn.mockReturnValue(42);

            // Usa la funzione mock
            const result = mockFn();

            // Verifica che la funzione sia stata chiamata
            expect(mockFn).toHaveBeenCalled();
            expect(result).toBe(42);
        });

        it('should spy on object methods', () => {
            const counter = new Counter();

            // Crea uno spy sul metodo getCount
            const spy = vi.spyOn(counter, 'getCount');

            // Usa l'oggetto normalmente
            counter.increment();
            const count = counter.getCount();

            // Verifica che il metodo sia stato chiamato
            expect(spy).toHaveBeenCalled();
            expect(count).toBe(1);
        });

        it('should mock modules', () => {
            // Mock di un modulo
            vi.mock('./some-module', () => {
                return {
                    someFunction: () => 'mocked result'
                };
            });

            // In un caso reale, importeresti il modulo e lo useresti
            // const { someFunction } = require('./some-module');
            // expect(someFunction()).toBe('mocked result');
        });
    });

    // Test parametrizzati
    describe('Parameterized tests', () => {
        // Test con dati multipli
        it.each([
            [1, 1, 2],
            [2, 2, 4],
            [3, 3, 6]
        ])('should add %i + %i to equal %i', (a, b, expected) => {
            expect(sum(a, b)).toBe(expected);
        });

        // Test con oggetti
        it.each([
            { input: 1, expected: 1 },
            { input: 2, expected: 4 },
            { input: 3, expected: 9 }
        ])('should square $input to equal $expected', ({ input, expected }) => {
            expect(input * input).toBe(expected);
        });
    });

    // Test condizionali
    describe('Conditional tests', () => {
        it.skipIf(process.env.NODE_ENV === 'production')('should skip in production', () => {
            // Questo test viene saltato in produzione
            expect(true).toBe(true);
        });

        it.runIf(process.env.DEBUG_MODE === 'true')('should run only in debug mode', () => {
            // Questo test viene eseguito solo in debug mode
            expect(true).toBe(true);
        });
    });

    // Test con snapshot
    it('should match snapshot', () => {
        const user = {
            name: 'John',
            age: 30,
            roles: ['admin', 'user']
        };

        // Confronta l'oggetto con uno snapshot salvato
        expect(user).toMatchSnapshot();
    });
});
