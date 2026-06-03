import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

const SYMBOL = require("../../assets/images/login/symbol.png");
const TYPO   = require("../../assets/images/login/typo.png");

interface Props {
  isReady: boolean;
  onDone: () => void;
}

const SplashAnimation: React.FC<Props> = ({ isReady, onDone }) => {
  // 심볼: 회전하며 낙하 (코인 떨어지는 느낌)
  const symY   = useRef(new Animated.Value(-100)).current;
  const symSc  = useRef(new Animated.Value(0.55)).current;
  const symOp  = useRef(new Animated.Value(0)).current;
  const symRot = useRef(new Animated.Value(-25)).current; // deg

  // 타이포: 오른쪽에서 스냅 인
  const typX   = useRef(new Animated.Value(40)).current;
  const typSc  = useRef(new Animated.Value(0.72)).current;
  const typOp  = useRef(new Animated.Value(0)).current;

  // 전체 로고: settle bounce + 스웨이 루프
  const logoSc  = useRef(new Animated.Value(1)).current;
  const logoRot = useRef(new Animated.Value(0)).current; // deg
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  // 화면 퇴장
  const screenOp = useRef(new Animated.Value(1)).current;
  const exitDone = useRef(false);

  const [entranceDone, setEntranceDone] = useState(false);
  const [minReady, setMinReady]         = useState(false);

  /* ── 퇴장 ── */
  const startExit = useCallback(() => {
    if (exitDone.current) return;
    exitDone.current = true;
    loopRef.current?.stop();
    Animated.timing(screenOp, {
      toValue: 0, duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => onDone());
  }, [onDone, screenOp]);

  /* ── 입장 ── */
  useEffect(() => {
    // 심볼: 비틀리며 낙하 — friction 낮춰 탄력 있게
    Animated.parallel([
      Animated.spring(symY,  { toValue: 0, tension: 75, friction: 5,  useNativeDriver: true }),
      Animated.spring(symSc, { toValue: 1, tension: 75, friction: 5,  useNativeDriver: true }),
      Animated.spring(symRot,{ toValue: 0, tension: 70, friction: 6,  useNativeDriver: true }),
      Animated.timing(symOp, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    // 타이포: 200ms 후 오른쪽에서 스냅 인 (스프링으로 통통)
    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.spring(typX,  { toValue: 0, tension: 160, friction: 7, useNativeDriver: true }),
        Animated.spring(typSc, { toValue: 1, tension: 160, friction: 7, useNativeDriver: true }),
        Animated.timing(typOp, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        // 착지 bounce: 전체 로고가 쿵 하고 한번 눌렸다 올라오는 느낌
        Animated.sequence([
          Animated.timing(logoSc, { toValue: 1.08, duration: 80,  easing: Easing.out(Easing.ease),   useNativeDriver: true }),
          Animated.timing(logoSc, { toValue: 0.96, duration: 90,  easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(logoSc, { toValue: 1.03, duration: 70,  easing: Easing.out(Easing.ease),   useNativeDriver: true }),
          Animated.timing(logoSc, { toValue: 1.0,  duration: 60,  easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]).start(() => {
          setEntranceDone(true);
          // 스웨이 루프: 좌우로 살짝 흔들리며 생동감
          const loop = Animated.loop(
            Animated.sequence([
              Animated.timing(logoRot, { toValue: 1.8,  duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(logoRot, { toValue: -1.8, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(logoRot, { toValue: 0,    duration: 700,  easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
          );
          loopRef.current = loop;
          loop.start();
        });
      });
    }, 200);

    return () => clearTimeout(t1);
  }, []);

  /* ── 최소 표시 시간 1.5초 ── */
  useEffect(() => {
    const tid = setTimeout(() => setMinReady(true), 1500);
    return () => clearTimeout(tid);
  }, []);

  /* ── 모두 준비 → 퇴장 ── */
  useEffect(() => {
    if (entranceDone && isReady && minReady) startExit();
  }, [entranceDone, isReady, minReady, startExit]);

  const symRotDeg = symRot.interpolate({ inputRange: [-25, 25], outputRange: ["-25deg", "25deg"] });
  const logoRotDeg = logoRot.interpolate({ inputRange: [-1.8, 1.8], outputRange: ["-1.8deg", "1.8deg"] });

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        opacity: screenOp,
      }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          transform: [{ scale: logoSc }, { rotate: logoRotDeg }],
        }}
      >
        {/* 심볼: 회전하며 낙하 */}
        <Animated.Image
          source={SYMBOL}
          style={{
            width: 44,
            height: 52,
            opacity: symOp,
            transform: [
              { translateY: symY },
              { scale: symSc },
              { rotate: symRotDeg },
            ],
          }}
          resizeMode="contain"
        />

        {/* 타이포: 오른쪽에서 스냅 */}
        <Animated.Image
          source={TYPO}
          style={{
            width: 103,
            height: 36,
            opacity: typOp,
            transform: [
              { translateX: typX },
              { scale: typSc },
            ],
          }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
};

export default SplashAnimation;
