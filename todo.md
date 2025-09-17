
Scaricare lo schema GraphQL dall'endpoint Apollo su AWS
Generare i tipi TypeScript e le operazioni (sì, le operations sono query e mutations)
Utilizzare questi tipi per chiamare gli endpoint GraphQL (con o senza autenticazione)


Tipi TypeScript per tutti gli oggetti definiti nello schema
Tipi per le operazioni (query/mutation) che hai definito
Un SDK di base che fornisce metodi tipizzati per chiamare le tue operazioni

// 1. Tipi per gli oggetti dello schema
export interface User {
id: string;
name: string;
email?: string | null;
}

// 2. Tipi per le operazioni
export interface GetUserQueryVariables {
id: string;
}

export interface GetUserQuery {
getUser?: User | null;
}

// 3. SDK di base
export const getSdk = (client: GraphQLClient) => {
return {
GetUser(variables: GetUserQueryVariables): Promise<GetUserQuery> {
return client.request<GetUserQuery>(GetUserDocument, variables);
}
};
};

Il confine tra Codegen e il tuo codice
Il confine è essenzialmente questo:

Codegen genera: Tipi, definizioni delle operazioni, e un SDK di base che richiede un client GraphQL
Tu implementi: Il client GraphQL, l'autenticazione, e tutto il codice che utilizza l'SDK generato