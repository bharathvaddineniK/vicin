import { supabase } from './supabase';

export type DraftData = {
  content: string;
  post_type: string;
  tags: string[];
  location_mode: string;
  venue_label: string;
  venue_coords: { lat: number; lng: number } | null;
  call_enabled: boolean;
  expiry_hours: number | null;
  custom_days: string;
};

export type Draft = {
  id: string;
  user_id: string;
  draft_data: DraftData;
  created_at: string;
  updated_at: string;
};

export async function saveDraft(draftData: DraftData): Promise<string> {
  console.log('saveDraft called with:', draftData);
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error('No session found when trying to save draft');
    throw new Error('User not authenticated');
  }
  
  console.log('User ID:', session.user.id);

  // Always create a new draft (don't update existing ones)
  console.log('Creating new draft...');
  const { data, error } = await supabase
    .from('post_drafts')
    .insert({
      user_id: session.user.id,
      draft_data: draftData,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating draft:', error);
    throw error;
  }
  console.log('Draft created successfully:', data);
  return data.id;
}

export async function loadDraft(): Promise<Draft | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return null;
  }

  // Get the most recent draft
  const { data, error } = await supabase
    .from('post_drafts')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No draft found
      return null;
    }
    throw error;
  }

  return data;
}

export async function deleteDraft(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return;
  }

  const { error } = await supabase
    .from('post_drafts')
    .delete()
    .eq('user_id', session.user.id);

  if (error) throw error;
}

export async function hasDraft(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return false;
  }

  const { data, error } = await supabase
    .from('post_drafts')
    .select('id')
    .eq('user_id', session.user.id)
    .limit(1);

  if (error) {
    throw error;
  }

  return data && data.length > 0;
}

export async function getAllDrafts(): Promise<Draft[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return [];
  }

  const { data, error } = await supabase
    .from('post_drafts')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function deleteDraftById(draftId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return;
  }

  const { error } = await supabase
    .from('post_drafts')
    .delete()
    .eq('id', draftId)
    .eq('user_id', session.user.id); // Ensure user can only delete their own drafts

  if (error) throw error;
}
