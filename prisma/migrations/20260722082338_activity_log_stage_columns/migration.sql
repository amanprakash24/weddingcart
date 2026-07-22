-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "fromStage" "PipelineStage",
ADD COLUMN     "toStage" "PipelineStage";
