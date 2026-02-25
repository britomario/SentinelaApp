-- Enable Supabase Realtime for child_credits_apps.
-- Permite atualização instantânea na tela dos pais ao adicionar app na tela da criança.
alter publication supabase_realtime add table public.child_credits_apps;
