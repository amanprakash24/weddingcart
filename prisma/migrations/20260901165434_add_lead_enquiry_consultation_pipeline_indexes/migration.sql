-- CreateIndex
CREATE INDEX "leads_pipelineStage_idx" ON "leads"("pipelineStage");

-- CreateIndex
CREATE INDEX "leads_assignedToId_pipelineStage_idx" ON "leads"("assignedToId", "pipelineStage");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- CreateIndex
CREATE INDEX "enquiries_pipelineStage_idx" ON "enquiries"("pipelineStage");

-- CreateIndex
CREATE INDEX "enquiries_assignedToId_pipelineStage_idx" ON "enquiries"("assignedToId", "pipelineStage");

-- CreateIndex
CREATE INDEX "enquiries_createdAt_idx" ON "enquiries"("createdAt");

-- CreateIndex
CREATE INDEX "consultations_pipelineStage_idx" ON "consultations"("pipelineStage");

-- CreateIndex
CREATE INDEX "consultations_assignedToId_pipelineStage_idx" ON "consultations"("assignedToId", "pipelineStage");

-- CreateIndex
CREATE INDEX "consultations_createdAt_idx" ON "consultations"("createdAt");
