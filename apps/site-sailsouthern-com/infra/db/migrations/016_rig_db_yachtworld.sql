-- Add debug_info for tracking consensus disagreements
ALTER TABLE boat_spec_consensus ADD COLUMN debug_info JSONB;

-- Add optional boat spec columns to match YachtWorld data points
ALTER TABLE boats ADD COLUMN engine_type TEXT;
ALTER TABLE boats ADD COLUMN keel_type TEXT;
