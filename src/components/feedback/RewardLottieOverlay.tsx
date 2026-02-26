/**
 * Micro-animação Lottie ao ganhar moedas ou concluir tarefa.
 * Exibida brevemente como feedback visual gamificado.
 */

import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Modal, Pressable, Dimensions} from 'react-native';
import LottieView from 'lottie-react-native';

const {width} = Dimensions.get('window');

type Props = Readonly<{
  visible: boolean;
  onFinish: () => void;
}>;

const coinSuccessSource = require('../../assets/animations/coin-success.json');

export function RewardLottieOverlay({visible, onFinish}: Props): React.JSX.Element {
  const ref = useRef<LottieView>(null);

  useEffect(() => {
    if (visible && ref.current) {
      ref.current?.play();
    }
  }, [visible]);

  if (!visible) {return <></>;}

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onFinish}
    >
      <Pressable style={styles.overlay} onPress={onFinish}>
        <View style={styles.animWrap}>
          <LottieView
            ref={ref}
            source={coinSuccessSource}
            autoPlay
            loop={false}
            style={styles.anim}
            onAnimationFinish={onFinish}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animWrap: {
    width: width * 0.5,
    aspectRatio: 1,
  },
  anim: {
    width: '100%',
    height: '100%',
  },
});
