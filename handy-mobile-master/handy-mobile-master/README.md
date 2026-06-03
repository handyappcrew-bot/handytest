# Handy Staff Mobile (React Native)

기존 Web (Vite + React + Tailwind + shadcn/ui + Capacitor) 프로젝트의 RN 포팅.
**Web 코드는 그대로 유지**, 본 폴더에서 별도 RN 앱으로 작업.

---

## 기술 스택

| 레이어 | Web | Mobile (RN) |
|---|---|---|
| 프레임워크 | Vite + React 18 | Expo SDK 52 + React Native 0.76 |
| 라우팅 | react-router-dom v6 | @react-navigation/native v7 |
| 스타일 | Tailwind + inline style | NativeWind v4 + StyleSheet/inline |
| 상태 저장 | localStorage | AsyncStorage (sync wrapper in `utils/storage.ts`) |
| 아이콘 | lucide-react | lucide-react-native |
| 애니메이션 | tailwindcss-animate, framer-motion | react-native-reanimated v3 |
| 토스트 | sonner / shadcn toast | 자체 구현 (`components/Toast.tsx`) |
| 모달/시트 | createPortal + animate-in | Modal + Reanimated |

---

## 시작하기

```bash
cd mobile
npm install
npx expo start
# Android: a 키 / iOS: i 키
```

### 백엔드 연결

`app.json` extra.apiUrl 또는 `EXPO_PUBLIC_API_URL` 환경변수로 설정.

| 환경 | API URL |
|---|---|
| Android 에뮬레이터 | `http://10.0.2.2:8000` (호스트 localhost) |
| iOS 시뮬레이터 | `http://localhost:8000` |
| 실 디바이스 | `http://<호스트 LAN IP>:8000` |
| 운영 | `https://<프로덕션 도메인>` |

---

## 폴더 구조

```
mobile/
├── App.tsx                  # 진입점 (Provider 래핑)
├── app.json                 # Expo 설정
├── babel.config.js          # NativeWind + Reanimated 플러그인
├── metro.config.js          # NativeWind metro 통합
├── tailwind.config.js       # 디자인 토큰 (web 과 동일 색상)
├── tsconfig.json            # @ alias = ./src
├── global.css               # Tailwind directives
└── src/
    ├── api/                 # 백엔드 API 클라이언트
    │   ├── client.ts        # fetch wrapper + 인증 토큰
    │   ├── auth.ts
    │   ├── employee.ts
    │   └── owner.ts
    ├── components/          # 재사용 UI
    │   ├── EmptyState.tsx   # 메시지 키워드 → 아이콘 자동 매핑
    │   ├── BottomSheet.tsx  # Modal + Reanimated
    │   ├── PageLayout.tsx   # 헤더/타이틀/푸터
    │   ├── PrimaryButton.tsx
    │   └── Toast.tsx        # ToastProvider + useToast()
    ├── navigation/
    │   ├── types.ts
    │   └── RootNavigator.tsx
    ├── screens/             # 화면 (web의 src/pages 대응)
    │   ├── LoginScreen.tsx
    │   ├── OwnerHomeScreen.tsx
    │   └── EmployeeHomeScreen.tsx
    ├── hooks/
    ├── utils/
    │   └── storage.ts       # localStorage 호환 wrapper
    └── assets/              # 이미지 / 아이콘
```

---

## Web → RN 변환 룰

### JSX 요소

| Web | RN | 비고 |
|---|---|---|
| `<div>` | `<View>` | 기본 컨테이너 |
| `<p>`, `<span>`, `<h1>` 등 | `<Text>` | 모든 텍스트는 `<Text>` 안에 있어야 함 |
| `<button onClick>` | `<Pressable onPress>` 또는 `<TouchableOpacity>` | `Pressable` 권장 (press state 지원) |
| `<input>` | `<TextInput>` | `value` / `onChangeText` |
| `<img src>` | `<Image source={{uri}}>` 또는 `expo-image` |
| `<a href>` | `Linking.openURL()` |
| `<select>` | 라이브러리 또는 BottomSheet picker |

### 스타일

| Web | RN |
|---|---|
| className="bg-primary" (Tailwind) | className 가능 (NativeWind) 또는 `style={{...}}` |
| `display: flex` | 기본값 (flex 항상 컨테이너 적용) |
| `flex-row` | `flexDirection: "row"` |
| `gap-X` | RN ≥ 0.71 부터 지원 |
| 박스 그림자 | iOS: `shadowColor/Opacity/Radius/Offset`, Android: `elevation` |
| `cursor: pointer` | 불필요 (Pressable 자체 처리) |
| `letterSpacing: '-0.02em'` | 숫자 (px) 단위로 변환: `-0.02em` × fontSize ≈ `-(fontSize × 0.02)` |
| `lineHeight: '1.5'` | 숫자 (px) 단위: fontSize × 1.5 |

### 인터랙션

| Web | RN |
|---|---|
| `onClick` | `onPress` |
| `onMouseEnter/Leave` | hover 없음 → 무시 또는 `Pressable`의 `pressed` |
| `event.stopPropagation()` | `Pressable`의 `onPress` 는 자동으로 부모로 전파 안 함 |
| `e.target.value` | `onChangeText(text)` 직접 받음 |

### 라우팅

| Web | RN |
|---|---|
| `useNavigate(); navigate("/path")` | `useNavigation(); nav.navigate("ScreenName")` |
| `useParams()` | `route.params` |
| `useLocation().state` | `route.params` |
| `Link to="/path"` | `Pressable onPress={() => nav.navigate(...)}` |

### Storage

```ts
// Web
localStorage.getItem("currentRole")

// RN (utils/storage.ts wrapper — 동기 인터페이스 유지)
import { localStorage } from "@/utils/storage";
localStorage.getItem("currentRole")
// 단, App 시작 시 await localStorage.init() 1회 필요 (RootNavigator 에 이미 적용)
```

### API 호출

```ts
// Web (fetch + credentials: 'include' 쿠키)
const res = await fetch(`${BASE_URL}/api/owner/store/${id}`, { credentials: 'include' });

// RN (api 헬퍼 + Authorization 토큰)
import { api } from "@/api/client";
const data = await api.get(`/api/owner/store/${id}`);
```

> ⚠️ 백엔드가 쿠키 only 발급이면 `react-native-cookies` 도입 필요.
> 현재 client.ts 는 토큰 응답 가정. 백엔드 응답 구조 확인 후 조정.

---

## 마이그레이션 진행 상황

### ✅ 완료 (이번 세션)
- 프로젝트 셋업 (Expo + NativeWind + RN Navigation)
- API 클라이언트 (`api/client.ts`) + 인증 토큰
- 핵심 컴포넌트
  - `EmptyState` (메시지 → 아이콘 자동 매핑 전수 포팅)
  - `BottomSheet` (200ms 슬라이드 Reanimated)
  - `PageLayout` (헤더/타이틀/푸터/Progress)
  - `PrimaryButton` + `ButtonRow`
  - `Toast` (ToastProvider + useToast)
- 화면
  - `LoginScreen` (web 로그인 화면 디자인 유지)
  - `OwnerHomeScreen` (오늘 출근 현황 + 직원별 상태)
  - `EmployeeHomeScreen` (오늘 근무 + 출퇴근 액션)
- API 모듈
  - `auth.ts` (login/logout/getMe/getMyStores/signup)
  - `employee.ts` (출퇴근, 스케줄, 마이페이지)
  - `owner.ts` (매장, 출퇴근 현황, 직원, 스케줄)

### ✅ Phase 1 — 인증/온보딩 (완료)

| 화면 | 파일 |
|---|---|
| 회원가입 (휴대폰) | `screens/signup/SignupScreen.tsx` |
| 인증번호 확인 | `screens/signup/CodeVerifyScreen.tsx` |
| 비밀번호 설정 | `screens/signup/PasswordScreen.tsx` |
| 회원 정보 + 약관 | `screens/signup/ProfileInfoScreen.tsx` |
| 프로필 사진 (Camera/Gallery) | `screens/signup/ProfilePhotoScreen.tsx` |
| 회원가입 완료 | `screens/signup/SignupCompleteScreen.tsx` |
| 약관 상세 | `screens/signup/TermsDetailScreen.tsx` |
| 회원 유형 선택 | `screens/onboarding/MemberTypeScreen.tsx` |
| 사장 사업자 인증 + 매장 정보 | `screens/owner/OwnerBusinessVerifyScreen.tsx` |
| 사장 사업자 등록증 업로드 | `screens/owner/OwnerBusinessUploadScreen.tsx` |
| 직원 매장 등록 (4-step 통합) | `screens/employee/EmployeeStoreRegistrationScreen.tsx` |

**부속 컴포넌트/유틸 신규:**
- `components/WheelPicker.tsx` (생년월일 wheel)
- `utils/valid.ts` (formatPhone, validatePhone)
- `utils/signupDraft.ts` (회원 정보 임시 저장)

### ✅ Phase 2 — 사장 핵심 (완료)

| 화면 | 파일 |
|---|---|
| 일정 관리 (3 탭: 주간/월간/요청) | `screens/owner/OwnerScheduleManagementScreen.tsx` |
| 근태 관리 (3 탭: 오늘/주간/요청) | `screens/owner/OwnerAttendanceManagementScreen.tsx` |
| 직원 관리 (직원/가입 요청) | `screens/owner/OwnerStaffManagementScreen.tsx` |
| 직원 상세 | `screens/owner/OwnerStaffDetailScreen.tsx` |
| 직원 계약 수정 | `screens/owner/OwnerStaffEditScreen.tsx` |
| 급여 관리 | `screens/owner/OwnerSalaryManagementScreen.tsx` |
| 급여명세서 상세 (발급/이체) | `screens/owner/PayslipDetailScreen.tsx` |
| 매장 정보 | `screens/owner/OwnerStoreInfoScreen.tsx` |
| 매장 정보 수정 | `screens/owner/OwnerStoreInfoEditScreen.tsx` |
| 영업시간 설정 | `screens/owner/OwnerStoreHoursScreen.tsx` |
| 매장 삭제 | `screens/owner/OwnerStoreDeleteScreen.tsx` |
| 마이 페이지 | `screens/owner/OwnerProfileScreen.tsx` |

**부속 컴포넌트 신규:**
- `components/TabBar.tsx` — sticky 탭바 + 카운트 배지
- `components/FilterChips.tsx` — 요청 필터 칩
- `components/Card.tsx` — 공통 카드 wrapper
- `components/RequestCard.tsx` — 요청 류 통일 카드 (사장 근태/일정/가입 요청)

### ✅ Phase 3 — 직원 핵심 (완료)

| 화면 | 파일 |
|---|---|
| 일정 (3 탭) | `screens/employee/EmployeeScheduleScreen.tsx` |
| 출퇴근 (3 탭) | `screens/employee/EmployeeAttendanceScreen.tsx` |
| 급여명세서 목록 | `screens/employee/EmployeeSalaryScreen.tsx` |
| 급여명세서 상세 | `screens/employee/EmployeePayStubDetailScreen.tsx` |
| 마이 페이지 | `screens/employee/EmployeeProfileScreen.tsx` |
| 마이 페이지 수정 | `screens/employee/EmployeeProfileEditScreen.tsx` |
| 일정 변경 요청 (3 step) | `screens/employee/ScheduleChangeRequestScreen.tsx` |
| 휴가 요청 (다일자) | `screens/employee/VacationRequestScreen.tsx` |
| 마감 보고 | `screens/employee/ClosingReportScreen.tsx` |

### ✅ Phase 4 — 공통 (완료)

| 화면 | 파일 |
|---|---|
| 게시판 목록 | `screens/common/BoardListScreen.tsx` |
| 게시글 상세 (댓글 포함) | `screens/common/BoardDetailScreen.tsx` |
| 게시글 작성 (이미지 첨부) | `screens/common/BoardWriteScreen.tsx` |
| 알림 목록 | `screens/common/NotificationsScreen.tsx` |
| 공지사항 목록 | `screens/common/AnnouncementsScreen.tsx` |
| 공지사항 상세 | `screens/common/AnnouncementDetailScreen.tsx` |
| FAQ (카테고리 필터 + accordion) | `screens/common/FAQScreen.tsx` |
| 건의함 목록 | `screens/common/FeedbackScreen.tsx` |
| 건의 상세 | `screens/common/FeedbackDetailScreen.tsx` |
| 건의 작성 | `screens/common/FeedbackWriteScreen.tsx` |
| 비밀번호 변경 | `screens/common/PasswordChangeScreen.tsx` |
| 회원 탈퇴 | `screens/common/WithdrawalScreen.tsx` |

### ✅ Phase 5 — 네이티브 전용 (완료)

| 기능 | 적용 위치 | 비고 |
|---|---|---|
| 카메라 / 갤러리 | `ProfilePhotoScreen`, `BoardWriteScreen`, `EmployeeProfileEditScreen`, `OwnerBusinessUploadScreen`, `ClosingReportScreen`, `FeedbackWriteScreen` | `expo-image-picker` |
| GPS (매장 반경 출퇴근) | `EmployeeHomeScreen` (출근/퇴근 액션) | `expo-location` + `utils/gps.ts` (Haversine 거리 + 반경 검증) |
| 푸시 알림 토큰 등록 | `OwnerHomeScreen`, `EmployeeHomeScreen` 진입 시 | `expo-notifications` + `expo-device` + `utils/push.ts` |
| SideMenu 사이드 메뉴 | 사장/직원 홈 우측 슬라이드 | `components/SideMenu.tsx` (Reanimated) |

### ✅ Phase 6 — 누락 화면 보강 (완료)

웹 `src/pages` ↔ 모바일 `mobile/src/screens` diff 결과 누락된 페이지를 추가.

| 화면 | 위치 | 진입 경로 |
|---|---|---|
| 근태 기준 설정 | `screens/owner/OwnerAttendanceStandardScreen.tsx` | `OwnerStoreInfoScreen` → "근태 기준 설정" 행 |
| 영업 파트 시간 (오픈/미들/마감) | `screens/owner/OwnerStoreHoursPartsScreen.tsx` | `OwnerStoreInfoScreen` → "영업 파트 시간 설정" 행 |
| 급여명세서 수정 | `screens/owner/PayslipEditScreen.tsx` | `PayslipDetailScreen` 헤더 우측 연필 아이콘 |
| 직원 급여 상세 | `screens/owner/SalaryDetailScreen.tsx` | (재사용) — 진입 path: `SalaryDetail { name, year?, month? }` |
| 출근 기록 수정 요청 (직원) | `screens/employee/AttendanceRecordEditScreen.tsx` | `EmployeeAttendanceScreen` → "수정 요청 내역" 탭 → "+ 새 수정 요청 보내기" 버튼 |
| 알림 딥링크 | `screens/common/NotificationDeepLinkScreen.tsx` | 푸시 알림 (`schedule_change` / `schedule_added`) 탭 시 |
| 404 NotFound | `screens/NotFoundScreen.tsx` | 잘못된 라우트 fallback |
| 백엔드 미구현 placeholder | `screens/PendingScreen.tsx` | `Pending { title, message, subMessage }` — 매출 / 사장측 출근기록 수정 등 |

**의도 통합 (별도 화면 미생성)**
- `OwnerStoreInfoEdit` 안에 매장/영업시간 통합 → 별도 분리 안함
- `OwnerSalaryManagement` 발급/완료 섹션이 SalaryDetail 역할 흡수
- `Notice/Faq` 작성 화면은 게시판과 동일 패턴 → 추후 필요 시 분리

### ✅ Phase 7 — UI 정밀 보강 (완료)

웹 ↔ 모바일 픽셀 단위 비교 후 누락된 아이콘/이미지/탭/색상을 보강.

| 항목 | 변경 |
|---|---|
| Login 로고/타이포 | `assets/images/login/symbol.png`, `typo.png` 추가 → 웹과 동일 PNG 표시 |
| Login SNS 버튼 | 카카오/애플/구글 PNG 3종 표시 (`Share.share` 또는 백엔드 합의 후 OAuth 연결) |
| Login Eye/EyeOff 토글 | 비밀번호 표시/숨김 + AlertCircle 에러 메시지 |
| 프로필 사진 | `utils/image.ts` `getPhotoUrl/photoSource` 헬퍼 → Owner/Employee/Staff 프로필에 RN `Image` 표시 |
| Success 색상 | `#10C97D` → `#1EDC83` 일괄 통일 (웹 디자인 토큰 일치) |
| OwnerSchedule FAB | Plus/X 토글 + UserPlus/UserMinus/CalendarClock/Palmtree 4개 액션 메뉴 |
| OwnerStaff "초대" 탭 | Share2 + 매장 코드 RN `Share.share` API |
| Payslip 이체 카드 | Check 아이콘 + 이체 완료 표시 (웹 동일 패턴) |
| Salary Info 배너 | Info 아이콘 + 발급 대기 / 급여일 안내 토글 |
| Schedule 탭 라벨 | "내 일정" → "나의 일정", "전체 일정" → "전체 직원 일정" (웹 라벨 일치) |
| Avatar 컴포넌트 | `components/Avatar.tsx` 신규 — 이미지 + 이니셜 hash 색 통일, OwnerProfile/OwnerStaffDetail/OwnerStaff목록/EmployeeProfile 4화면 적용 |
| Toast 확장 | `title` + `action` prop 추가 (웹 ToastTitle/ToastAction 매핑) |
| 사진 placeholder | ProfilePhoto/EmployeeProfileEdit 빈 사진 → Camera 아이콘 표시 (회색 박스 제거) |

### ✅ 홈 메뉴 라우팅 (완료)

**사장 홈 메뉴 그리드 (6개 카드):**
일정 관리 / 근태 관리 / 직원 관리 / 급여 관리 / 매장 정보 / 게시판

**직원 홈 메뉴 그리드 (6개 카드):**
일정 / 출퇴근 / 급여 / 휴가 요청 / 마감 보고 / 게시판

**SideMenu 메뉴 (양쪽 동일):**
공지사항 / 자주 묻는 질문 / 건의함 / 비밀번호 변경 / 내 정보 수정 / 회원 탈퇴 / 로그아웃

---

## 백엔드 / DB 수정 요청 사항

본 RN 포팅 과정에서 새로 발견된 백엔드 요청 사항은 없음.
프로젝트 루트 `INTEGRATION_NOTES.md` §2 (백엔드 요청 사항) 가 그대로 유효.
RN 측 추가 사항만 정리:

### RN 전용 검토 항목

| # | 항목 | 영향 |
|---|------|------|
| RN-1 | 인증 방식 (쿠키 vs 토큰) 확정 | 쿠키 only 면 `react-native-cookies` 도입 또는 백엔드가 토큰을 응답 body 에 포함하도록 변경 |
| RN-2 | CORS / 동일 출처 정책 | 모바일은 동일 출처가 아니므로 백엔드 CORS 가 모든 origin 허용 또는 `*` 가능해야 함 |
| RN-3 | 파일 업로드 multipart | RN FormData 의 파일 객체 형식 (`{uri, type, name}`) 을 백엔드가 정상 파싱하는지 |
| RN-4 | 푸시 알림 토큰 등록 | `POST /api/auth/fcm-token` 은 이미 존재. expo push token 또는 FCM token 어느쪽 보낼지 합의 |
| RN-5 | SNS 로그인 (카카오/애플/구글) | 모바일은 WebView 리다이렉트가 매끄럽지 않음 → expo-auth-session + 네이티브 SDK 도입 또는 백엔드가 deeplink 콜백 지원 필요 |
| RN-6 | OwnerSchedule 일일 일정 추가/삭제/변경/휴가 처리 | 웹의 4개 모달(`DailyScheduleAdd`, `DailyScheduleDelete`, `DailyScheduleChange`, `DailyVacationSetting`)에 대응되는 백엔드 엔드포인트 합의 후 모바일 화면 구현 |

→ 본 6건은 백엔드 합의 시 본 README 와 INTEGRATION_NOTES 에 결정 내용 기록.
