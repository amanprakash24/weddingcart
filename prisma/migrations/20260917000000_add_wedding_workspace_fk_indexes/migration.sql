-- CreateIndex
CREATE INDEX "wedding_events_weddingId_date_idx" ON "wedding_events"("weddingId", "date");

-- CreateIndex
CREATE INDEX "tasks_weddingId_createdAt_idx" ON "tasks"("weddingId", "createdAt");

-- CreateIndex
CREATE INDEX "timeline_milestones_weddingId_sortOrder_idx" ON "timeline_milestones"("weddingId", "sortOrder");

-- CreateIndex
CREATE INDEX "documents_weddingId_createdAt_idx" ON "documents"("weddingId", "createdAt");

-- CreateIndex
CREATE INDEX "invoices_weddingId_createdAt_idx" ON "invoices"("weddingId", "createdAt");
