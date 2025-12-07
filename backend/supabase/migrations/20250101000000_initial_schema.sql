-- Create tools table
CREATE TABLE IF NOT EXISTS public.tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    version VARCHAR(50) DEFAULT '1.0.0',
    enabled BOOLEAN DEFAULT true,
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create tool_executions table
CREATE TABLE IF NOT EXISTS public.tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parameters JSONB DEFAULT '{}',
    result JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tools_category ON public.tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_enabled ON public.tools(enabled);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_id ON public.tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_user_id ON public.tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON public.tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_tool_executions_started_at ON public.tool_executions(started_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tools table
CREATE TRIGGER update_tools_updated_at
    BEFORE UPDATE ON public.tools
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tools
CREATE POLICY "Tools are viewable by everyone"
    ON public.tools FOR SELECT
    USING (enabled = true);

CREATE POLICY "Authenticated users can create tools"
    ON public.tools FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update their own tools"
    ON public.tools FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

-- RLS Policies for tool_executions
CREATE POLICY "Users can view their own executions"
    ON public.tool_executions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own executions"
    ON public.tool_executions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Insert sample tools
INSERT INTO public.tools (name, description, type, category) VALUES
    ('Data Processor', 'Process and transform data', 'data_processor', 'utilities'),
    ('API Caller', 'Call external APIs', 'api_caller', 'integration'),
    ('Calculator', 'Perform mathematical calculations', 'calculator', 'utilities')
ON CONFLICT DO NOTHING;
