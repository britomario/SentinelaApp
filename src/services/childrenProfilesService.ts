import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChildProfile = {
  id: string;
  name: string;
  avatarUri?: string;
  avatarColor: string;
  status: 'active' | 'paused';
  pairedAt: number;
};

const STORAGE_KEY = '@sentinela/children_profiles';
export const MAX_CHILDREN_PROFILES = 3;

const AVATAR_COLORS = ['#60A5FA', '#34D399', '#A78BFA', '#F97316', '#F472B6'];

function createProfile(name: string): ChildProfile {
  const seed = Date.now();
  return {
    id: `child-${seed}`,
    name,
    avatarColor: AVATAR_COLORS[seed % AVATAR_COLORS.length],
    status: 'active',
    pairedAt: seed,
  };
}

export async function getChildrenProfiles(): Promise<ChildProfile[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as ChildProfile[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.slice(0, MAX_CHILDREN_PROFILES);
  } catch {
    return [];
  }
}

async function saveProfiles(profiles: ChildProfile[]): Promise<ChildProfile[]> {
  const next = profiles.slice(0, MAX_CHILDREN_PROFILES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function addChildProfile(name: string): Promise<{ok: boolean; profiles: ChildProfile[]}> {
  const normalized = name.trim();
  const current = await getChildrenProfiles();
  if (!normalized || current.length >= MAX_CHILDREN_PROFILES) {
    return {ok: false, profiles: current};
  }
  const next = await saveProfiles([createProfile(normalized), ...current]);
  return {ok: true, profiles: next};
}

export async function removeChildProfile(profileId: string): Promise<ChildProfile[]> {
  const current = await getChildrenProfiles();
  return saveProfiles(current.filter(profile => profile.id !== profileId));
}

export async function updateChildAvatar(profileId: string, avatarUri?: string): Promise<ChildProfile[]> {
  const current = await getChildrenProfiles();
  const next = current.map(profile =>
    profile.id === profileId ? {...profile, avatarUri} : profile,
  );
  return saveProfiles(next);
}
