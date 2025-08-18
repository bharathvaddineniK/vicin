-- Create post_drafts table for storing draft posts
CREATE TABLE IF NOT EXISTS public.post_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  draft_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own drafts
CREATE POLICY "Users can manage their own drafts" ON public.post_drafts
  FOR ALL USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_post_drafts_user_id ON public.post_drafts(user_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_post_drafts_updated_at 
    BEFORE UPDATE ON public.post_drafts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
