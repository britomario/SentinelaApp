import React, {useRef, useState} from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  NativeModules,
} from 'react-native';

import PinGate from '../../components/security/PinGate';
import {useToast} from '../../components/feedback/ToastProvider';
import {useChildTasks} from '../../hooks/useChildTasks';
import {BorderRadius, Colors, Shadows, Spacing} from '../../theme/colors';

export default function TasksScreen(): React.JSX.Element {
  const {showToast} = useToast();
  const {tasks, loading, createTask, updateTask, removeTask} = useChildTasks();
  const [taskModal, setTaskModal] = useState<
    'new' | {id: string; title: string; reward: number} | null
  >(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskReward, setTaskReward] = useState('50');
  const [pinGateVisible, setPinGateVisible] = useState(false);
  const pendingPinActionRef = useRef<() => void | Promise<void>>(() => {});

  const executeWithPin = (action: () => void | Promise<void>) => {
    const run = async () => {
      try {
        const hasPin = await (NativeModules as any).SecurityModule?.hasSecurityPin?.();
        if (!hasPin) {
          await action();
          return;
        }
      } catch {
        // Fallback to pin gate.
      }
      pendingPinActionRef.current = action;
      setPinGateVisible(true);
    };
    run();
  };

  const onPinSuccess = async () => {
    const action = pendingPinActionRef.current;
    if (action) {
      await action();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tarefas</Text>
        <Text style={styles.subtitle}>
          Gamificação familiar com recompensas em moedas para incentivar rotina e foco.
        </Text>

        <TouchableOpacity
          style={styles.newTaskBtn}
          onPress={() => {
            setTaskModal('new');
            setTaskTitle('');
            setTaskReward('50');
          }}>
          <Text style={styles.newTaskBtnText}>+ Nova tarefa</Text>
        </TouchableOpacity>

        {loading ? (
          <Text style={styles.loading}>Carregando...</Text>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nenhuma tarefa cadastrada. Crie a primeira para começar a gamificação.
            </Text>
          </View>
        ) : (
          tasks.map(task => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskReward}>{task.rewardCoins} moedas</Text>
              </View>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setTaskModal({id: task.id, title: task.title, reward: task.rewardCoins});
                  setTaskTitle(task.title);
                  setTaskReward(String(task.rewardCoins));
                }}>
                <Text style={styles.actionBtnText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() =>
                  executeWithPin(async () => {
                    const ok = await removeTask(task.id);
                    showToast(
                      ok
                        ? {kind: 'success', title: 'Tarefa removida'}
                        : {kind: 'error', title: 'Falha ao remover'},
                    );
                  })
                }>
                <Text style={[styles.actionBtnText, styles.deleteText]}>Excluir</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!taskModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {taskModal === 'new' ? 'Nova tarefa' : 'Editar tarefa'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nome da tarefa"
              placeholderTextColor={Colors.textMuted}
              value={taskTitle}
              onChangeText={setTaskTitle}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Recompensa (moedas)"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              value={taskReward}
              onChangeText={setTaskReward}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setTaskModal(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave]}
                onPress={() => {
                  const title = taskTitle.trim();
                  const reward = parseInt(taskReward, 10) || 0;
                  if (!title) {
                    showToast({kind: 'error', title: 'Digite o nome da tarefa'});
                    return;
                  }
                  executeWithPin(async () => {
                    const modal = taskModal;
                    if (modal === 'new') {
                      const created = await createTask(title, reward);
                      setTaskModal(null);
                      showToast(
                        created
                          ? {kind: 'success', title: 'Tarefa criada'}
                          : {kind: 'error', title: 'Falha ao criar'},
                      );
                    } else if (modal && 'id' in modal) {
                      const ok = await updateTask(modal.id, title, reward);
                      setTaskModal(null);
                      showToast(
                        ok
                          ? {kind: 'success', title: 'Tarefa atualizada'}
                          : {kind: 'error', title: 'Falha ao atualizar'},
                      );
                    }
                  });
                }}>
                <Text style={styles.modalSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PinGate
        visible={pinGateVisible}
        onClose={() => setPinGateVisible(false)}
        onSuccess={onPinSuccess}
        title="Digite o PIN para continuar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {padding: Spacing.lg, paddingBottom: Spacing.xxl},
  title: {fontSize: 26, fontWeight: '800', color: Colors.textPrimary},
  subtitle: {
    marginTop: 6,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  newTaskBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  newTaskBtnText: {color: Colors.white, fontWeight: '700'},
  loading: {marginTop: Spacing.md, color: Colors.textSecondary},
  emptyCard: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadows.soft,
  },
  emptyText: {color: Colors.textSecondary},
  taskCard: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.low,
  },
  taskInfo: {flex: 1},
  taskTitle: {fontSize: 16, fontWeight: '700', color: Colors.textPrimary},
  taskReward: {marginTop: 2, color: Colors.textSecondary, fontSize: 13},
  actionBtn: {paddingHorizontal: Spacing.sm, paddingVertical: 4},
  actionBtnText: {color: Colors.primary, fontWeight: '600'},
  deleteBtn: {marginLeft: 4},
  deleteText: {color: Colors.alert},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalTitle: {fontSize: 19, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md},
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  modalActions: {flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm},
  modalBtn: {flex: 1, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center'},
  modalCancel: {backgroundColor: Colors.border},
  modalSave: {backgroundColor: Colors.primary},
  modalCancelText: {color: Colors.textSecondary, fontWeight: '600'},
  modalSaveText: {color: Colors.white, fontWeight: '700'},
});
