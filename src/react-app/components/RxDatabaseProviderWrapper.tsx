import { ReactElement, useEffect, useState } from 'react';
import { RxDatabase } from 'rxdb';
import { RxDatabaseProvider } from 'rxdb/plugins/react';
import { getDatabase, type RxCollections } from '../lib/database';
import { Loading } from './ui';

export function RxDatabaseProviderWrapper({ children }: { children: ReactElement }) {
    const [database, setDatabase] = useState<RxDatabase<RxCollections> | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initDb = async () => {
            try {
                const db = await getDatabase();
                setDatabase(db);
            } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo iniciar la base de datos local");
            }
        };
        initDb();
    }, []);

    if (error) {
        return <Loading fullPage text={error} />;
    }
    if (database == null) {
        return <Loading fullPage text="Iniciando base de datos..." />;
    }
    return (
        <RxDatabaseProvider database={database}>
            {children}
        </RxDatabaseProvider>
    );
};
