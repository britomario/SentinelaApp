import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

type ToastKind = 'success' | 'error' | 'info';

type ToastInput = {
  title: string;
  message?: string;
  kind?: ToastKind;
  durationMs?: number;
};

type ToastItem = ToastInput & {id: number; kind: ToastKind};

type ToastContextType = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((input: ToastInput) => {
    idRef.current += 1;
    const item: ToastItem = {
      id: idRef.current,
      title: input.title,
      message: input.message,
      durationMs: input.durationMs ?? 2800,
      kind: input.kind ?? 'info',
    };
    setQueue(prev => [...prev, item]);
    setTimeout(() => {
      setQueue(prev => prev.filter(t => t.id !== item.id));
    }, item.durationMs);
  }, []);

  const value = useMemo(() => ({showToast}), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.container}>
        {queue.map(toast => (
          <TouchableOpacity
            key={toast.id}
            activeOpacity={0.9}
            onPress={() => setQueue(prev => prev.filter(t => t.id !== toast.id))}
            style={[styles.toast, toast.kind === 'success' && styles.success, toast.kind === 'error' && styles.error]}>
            <Text style={styles.title}>{toast.title}</Text>
            {!!toast.message && <Text style={styles.message}>{toast.message}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 56,
    gap: 8,
  },
  toast: {
    backgroundColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#60A5FA',
  },
  success: {
    borderLeftColor: '#34D399',
  },
  error: {
    borderLeftColor: '#F87171',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  message: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 2,
  },
});
