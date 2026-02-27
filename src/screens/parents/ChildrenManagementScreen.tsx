import React, {useCallback, useEffect, useState} from 'react';
import {
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {Camera, Trash2, UserRound} from 'lucide-react-native';

import {useToast} from '../../components/feedback/ToastProvider';
import {
  addChildProfile,
  ChildProfile,
  getChildrenProfiles,
  MAX_CHILDREN_PROFILES,
  removeChildProfile,
  updateChildAvatar,
  updateChildName,
} from '../../services/childrenProfilesService';
import {setSelectedChildId} from '../../services/pairingService';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'C') + (parts[1]?.[0] ?? '');
}

export default function ChildrenManagementScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const {showToast} = useToast();
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [childName, setChildName] = useState('');
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ChildProfile | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const loadProfiles = useCallback(() => {
    getChildrenProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleAddProfile = async () => {
    const result = await addChildProfile(childName);
    if (!result.ok) {
      showToast({
        kind: 'info',
        title: 'Limite atingido',
        message: `Você pode monitorar até ${MAX_CHILDREN_PROFILES} perfis.`,
      });
      return;
    }
    setProfiles(result.profiles);
    setChildName('');
    setAddModalVisible(false);
  };

  const requestPhotoPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {return true;}
    try {
      const apiLevel = Platform.Version as number;
      const perm =
        apiLevel >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
      const result = await PermissionsAndroid.request(perm, {
        title: 'Acesso às fotos',
        message: 'Permita o acesso à galeria para escolher a foto do perfil.',
        buttonPositive: 'Permitir tudo',
      });
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const handleChangePhoto = async (profile: ChildProfile) => {
    const granted = await requestPhotoPermission();
    if (!granted) {
      showToast({
        kind: 'error',
        title: 'Permissão negada',
        message: 'É necessário permitir acesso às fotos para adicionar imagem ao perfil.',
      });
      return;
    }
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });
      if (result.didCancel) {return;}
      if (result.errorCode) {
        showToast({
          kind: 'error',
          title: 'Erro na galeria',
          message: result.errorMessage ?? 'Não foi possível abrir a galeria.',
        });
        return;
      }
      const uri = result.assets?.[0]?.uri;
      if (uri) {
        const next = await updateChildAvatar(profile.id, uri);
        setProfiles(next);
        showToast({kind: 'success', title: 'Foto atualizada'});
      }
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Galeria indisponível',
        message: 'Não foi possível abrir a galeria. Tente novamente.',
      });
    }
  };

  const openEditName = (profile: ChildProfile) => {
    setEditingProfile(profile);
    setEditNameValue(profile.name);
    setEditNameModalVisible(true);
  };

  const handleSaveName = async () => {
    const name = editNameValue.trim();
    if (!name || !editingProfile) {
      showToast({kind: 'error', title: 'Nome inválido', message: 'Digite um nome ou apelido.'});
      return;
    }
    const next = await updateChildName(editingProfile.id, name);
    setProfiles(next);
    setEditNameModalVisible(false);
    setEditingProfile(null);
    setEditNameValue('');
    showToast({kind: 'success', title: 'Nome atualizado'});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Filhos e Dispositivos</Text>
      <Text style={styles.subtitle}>
        Gerencie perfis pareados via QR Code com visual rápido e organizado.
      </Text>

      <LinearGradient
        colors={['#312E81', '#06B6D4']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.pairingHero}>
        <Text style={styles.heroTitle}>Adicionar Novo Dispositivo</Text>
        <Text style={styles.heroDesc}>
          Gere um novo QR de pareamento para conectar outro celular.
        </Text>
        <TouchableOpacity
          style={styles.heroButton}
          onPress={() => navigation.navigate('Parear')}>
          <Text style={styles.heroButtonText}>Abrir Pareamento QR</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.limitRow}>
        <Text style={styles.limitText}>
          Perfis visíveis: {profiles.length}/{MAX_CHILDREN_PROFILES}
        </Text>
        <TouchableOpacity
          style={[
            styles.addProfileBtn,
            profiles.length >= MAX_CHILDREN_PROFILES && styles.addProfileBtnDisabled,
          ]}
          onPress={() => setAddModalVisible(true)}
          disabled={profiles.length >= MAX_CHILDREN_PROFILES}>
          <Text style={styles.addProfileBtnText}>+ Novo Perfil</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardsList}>
        {profiles.map(profile => (
          <TouchableOpacity
            key={profile.id}
            style={styles.childCard}
            onPress={async () => {
              if (profile.childId) {
                await setSelectedChildId(profile.childId);
                showToast({
                  kind: 'success',
                  title: 'Perfil selecionado',
                  message: `Monitorando ${profile.name}.`,
                });
              }
            }}
            activeOpacity={profile.childId ? 0.7 : 1}>
            <View style={[styles.avatarCircle, {backgroundColor: profile.avatarColor}]}>
              {profile.avatarUri ? (
                <Image source={{uri: profile.avatarUri}} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{getInitials(profile.name)}</Text>
              )}
            </View>
            <View style={styles.childInfo}>
              <TouchableOpacity
                onPress={e => {
                  e.stopPropagation();
                  openEditName(profile);
                }}
                activeOpacity={0.7}
                hitSlop={{top: 8, bottom: 8, left: 0, right: 0}}>
                <Text style={styles.childName}>{profile.name}</Text>
              </TouchableOpacity>
              <Text style={styles.childStatus}>
                {profile.status === 'active' ? 'Proteção ativa' : 'Proteção pausada'}
              </Text>
            </View>
            <View style={styles.childActions}>
              <TouchableOpacity
                style={styles.iconAction}
                onPress={e => {
                  e.stopPropagation();
                  handleChangePhoto(profile);
                }}>
                <Camera size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconAction}
                onPress={async e => {
                  e.stopPropagation();
                  const next = await removeChildProfile(profile.id);
                  setProfiles(next);
                }}>
                <Trash2 size={18} color={Colors.alert} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
        {profiles.length === 0 && (
          <View style={styles.emptyState}>
            <UserRound size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum perfil pareado ainda.</Text>
          </View>
        )}
      </View>

      <Modal visible={addModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Novo Perfil</Text>
            <TextInput
              value={childName}
              onChangeText={setChildName}
              placeholder="Nome do filho"
              placeholderTextColor={Colors.textMuted}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirm]}
                onPress={() => handleAddProfile()}>
                <Text style={styles.modalConfirmText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editNameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar nome</Text>
            <TextInput
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder="Nome ou apelido do filho"
              placeholderTextColor={Colors.textMuted}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => {
                  setEditNameModalVisible(false);
                  setEditingProfile(null);
                  setEditNameValue('');
                }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirm]}
                onPress={handleSaveName}>
                <Text style={styles.modalConfirmText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {padding: Spacing.lg, paddingBottom: Spacing.xxl},
  title: {fontSize: 26, fontWeight: '800', color: Colors.textPrimary},
  subtitle: {
    marginTop: 6,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  pairingHero: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.medium,
  },
  heroTitle: {fontSize: 20, fontWeight: '800', color: Colors.white},
  heroDesc: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 19,
  },
  heroButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  heroButtonText: {fontWeight: '700', color: '#1E3A8A'},
  limitRow: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitText: {fontSize: 13, color: Colors.textSecondary, fontWeight: '600'},
  addProfileBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addProfileBtnDisabled: {backgroundColor: Colors.textMuted},
  addProfileBtnText: {color: Colors.white, fontWeight: '700'},
  cardsList: {marginTop: Spacing.md, gap: Spacing.md},
  childCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.soft,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {width: '100%', height: '100%'},
  avatarInitials: {color: Colors.white, fontWeight: '800', fontSize: 18},
  childInfo: {flex: 1, marginLeft: Spacing.md},
  childName: {fontSize: 16, fontWeight: '700', color: Colors.textPrimary},
  childStatus: {fontSize: 13, color: Colors.textSecondary, marginTop: 2},
  childActions: {flexDirection: 'row', gap: Spacing.sm},
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: {color: Colors.textSecondary, fontWeight: '600'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
  },
  modalTitle: {fontSize: 18, fontWeight: '700', color: Colors.textPrimary},
  modalInput: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
  },
  modalActions: {marginTop: Spacing.md, flexDirection: 'row', gap: Spacing.sm},
  modalBtn: {flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: 12},
  modalCancel: {backgroundColor: Colors.border},
  modalConfirm: {backgroundColor: Colors.primary},
  modalCancelText: {color: Colors.textSecondary, fontWeight: '600'},
  modalConfirmText: {color: Colors.white, fontWeight: '700'},
});
