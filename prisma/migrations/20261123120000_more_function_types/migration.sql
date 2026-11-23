-- More function types (23 Nov 2026): Tilak, Janeu, Anniversary, Griha Pravesh. Additive only (new enum values; PostgreSQL 12+).
ALTER TYPE "WeddingEventType" ADD VALUE 'TILAK';
ALTER TYPE "WeddingEventType" ADD VALUE 'JANEU';
ALTER TYPE "WeddingEventType" ADD VALUE 'ANNIVERSARY';
ALTER TYPE "WeddingEventType" ADD VALUE 'GRIHA_PRAVESH';
