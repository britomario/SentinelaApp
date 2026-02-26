import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChildProfile = {
  id: string;
  childId?: string; // pair-XXX for location/dispatch - set when paired
  name: string;
  avatarUri?: string;
  avatarColor: string;
  status: 'active' | 'paused';
  pairedAt: number;
};

const STORAGE_KEY = '@sentinela/children_profiles';
export const MAX_CHILDREN_PROFILES = 3;

const AVATAR_COLORS = ['#60A5FA', '#34D399', '#A78BFA', '#F97316', '#F472B6'];

function createProfile(name: string, childId?: string): ChildProfile {
  const seed = Date.now();
  const id = childId ?? `child-${seed}`;
  return {
    id,
    childId: childId ?? undefined,
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

/** Create profile with childId when parent generates pairing QR (for location/dispatch). */
export async function addChildProfileFromPairing(
  childId: string,
  name = 'Dispositivo conectado',
): Promise<{ok: boolean; profiles: ChildProfile[]}> {
  const current = await getChildrenProfiles();
  if (current.some(p => p.childId === childId)) {
    return {ok: true, profiles: current};
  }
  if (current.length >= MAX_CHILDREN_PROFILES) {
    const withoutChildId = current.find(p => !p.childId);
    if (withoutChildId) {
      const next = await saveProfiles(
        current.map(p =>
          p.id === withoutChildId.id ? {...p, childId} : p,
        ),
      );
      return {ok: true, profiles: next};
    }
    return {ok: false, profiles: current};
  }
  const next = await saveProfiles([createProfile(name, childId), ...current]);
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

export async function updateChildProfileChildId(
  profileId: string,
  childId: string,
): Promise<ChildProfile[]> {
  const current = await getChildrenProfiles();
  const next = current.map(profile =>
    profile.id === profileId ? {...profile, childId} : profile,
  );
  return saveProfiles(next);
}
