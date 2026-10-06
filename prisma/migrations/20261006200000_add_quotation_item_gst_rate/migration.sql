-- GST per quotation line: the rate the vendor typed, in hundredths of a percent (18% = 1800). Additive; existing lines stay NULL (no GST).
ALTER TABLE "quotation_items" ADD COLUMN     "gstRateBp" INTEGER;
