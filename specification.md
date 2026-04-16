# COCO 웹 서비스 기술 명세서

> **최종 업데이트**: 2026년 4월 2일 — AI 아바타, AR 오버레이, AI 탐험 큐레이션 기능 반영

## 1. 개요

### 1.1 서비스명
- **COCO** (일본어 ここ = "이곳"에서 착안)
- 카메라를 친구 추가 및 장소 기반 소셜 인터페이스로 확장한 **위치 기반 카메라 SNS 웹 서비스**

### 1.2 목적
본 문서는 COCO 서비스의 웹 MVP 구현을 위한 기술 명세를 정의한다.
MVP 범위에 집중하여 웹 브라우저에서 동작하는 프로토타입을 구현한다.

---

## 2. MVP 기능 범위

### 2.1 포함 기능
| # | 기능 | 설명 | 상태 |
|---|------|------|------|
| F1 | 카메라 기반 주변 사용자 탐지 | WebRTC 카메라 + Geolocation으로 주변 COCO 활성 사용자 표시 | ✅ 완료 |
| F2 | 친구 추가/임시 연결 | 주변 사용자에게 친구 요청 또는 임시 세션 시작 | ✅ 완료 |
| F3 | 펜팔 모드 번역 채팅 | WebSocket 기반 실시간 채팅 + MyMemory 메시지 단위 번역 | ✅ 완료 |
| F4 | 위치 기반 사진 기록 | 촬영 사진을 좌표/시간/방향과 함께 저장 | ✅ 완료 |
| F5 | 지도 플래그 & 흔적 탐색 | Leaflet.js 다크맵 위에 사진 흔적 표시 및 탐색 | ✅ 완료 |
| F6 | 공개/비공개 설정 | 흔적 단위 visibility 제어 (public/friends/private) | ✅ 완료 |
| F7 | AR 나침반 아바타 오버레이 | 카메라 화면에서 주변 사용자 방위각 기반 AR 아바타 표시 | ✅ 완료 |
| F8 | AI 아바타 생성 | DiceBear 자동 아바타 + DALL-E 2 수동 AI 아바타 | ✅ 완료 |
| F9 | AI 탐험 큐레이션 | GPT-4o-mini 기반 개인화 장소 추천 (흔적 없어도 동작) | ✅ 완료 |

### 2.2 제외 기능 (후순위)
- 얼굴 합성 / 단체 사진 보정
- 고도화 AR 이펙트 (파티클, 오브젝트 AR)
- 여행 동선 자동 생성
- 대규모 공개 익명 커뮤니티

---

## 3. 기술 스택

| 계층 | 기술 | 이유 |
|------|------|------|
| Backend | Python FastAPI | 비동기 WebSocket 지원, 빠른 API 개발 |
| Database | SQLite + SQLAlchemy | MVP 경량 DB, 별도 서버 불필요 |
| Frontend | HTML5 / CSS3 / Vanilla JS | 의존성 최소화 |
| 지도 | Leaflet.js + CartoCDN (다크맵) | 오픈소스, 무료, 다크 테마 지원 |
| 카메라 | WebRTC getUserMedia API | 브라우저 네이티브 카메라 접근 |
| 실시간통신 | FastAPI WebSocket | 주변 사용자 탐지 + 채팅 |
| 번역 | MyMemory Translation API | 무료 번역 API |
| AI 아바타 (자동) | DiceBear API v8 | 무료, 로그인 시 자동 생성 |
| AI 아바타 (수동) | OpenAI DALL-E 2 | 닉네임 기반 AI 일러스트 생성 |
| AI 탐험 큐레이션 | OpenAI GPT-4o-mini | 흔적 분석 기반 개인화 장소 추천 |
| 환경변수 | python-dotenv | API 키 보안 관리 |
| HTTPS | Self-signed cert (openssl) | 모바일 카메라/위치 권한 요구 대응 |

---

## 4. 시스템 아키텍처

```
┌─────────────────────────────────────────────────┐
│                 Browser Client                   │
│  ┌──────────┐ ┌────────┐ ┌──────┐ ┌──────────┐ │
│  │  Camera  │ │  Map   │ │ Chat │ │  Nearby  │ │
│  │ +AR 오버│ │+탐험패 │ │      │ │ +나침반  │ │
│  │  레이    │ │ 널     │ │      │ │  헤딩    │ │
│  └────┬─────┘ └───┬────┘ └──┬───┘ └────┬─────┘ │
│       │           │          │           │        │
│  ┌────┴───────────┴──────────┴───────────┴────┐  │
│  │              Main App Controller            │  │
│  │  (app.js: 아바타, 탐험, AR 베어링 포지션)  │  │
│  └────────────────────┬────────────────────────┘  │
└───────────────────────┼──────────────────────────┘
                        │ HTTPS / WSS
┌───────────────────────┼──────────────────────────┐
│              FastAPI Server                       │
│  ┌─────────────────────┴────────────────────────┐ │
│  │               API Router Layer               │ │
│  │  /auth  /users  /traces  /chat               │ │
│  │  /users/{id}/default-avatar (DiceBear)       │ │
│  │  /users/{id}/generate-avatar (DALL-E 2)      │ │
│  │  /explore/recommend (GPT-4o-mini)            │ │
│  └─────────────────────┬────────────────────────┘ │
│  ┌─────────────────────┴────────────────────────┐ │
│  │             Service Layer                    │ │
│  │  NearbyManager (heading, avatar_data)        │ │
│  │  TraceService | ChatService + MyMemory       │ │
│  │  ExploreRecommendService (GPT)               │ │
│  └─────────────────────┬────────────────────────┘ │
│  ┌─────────────────────┴────────────────────────┐ │
│  │           SQLite Database                    │ │
│  │  users (+ avatar_data) | camera_sessions     │ │
│  │  connections | traces | messages             │ │
│  └──────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

---

## 5. 데이터 모델

### 5.1 User
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| nickname | VARCHAR(50) | 닉네임 |
| language | VARCHAR(10) | 사용 언어 코드 |
| profile_visibility | ENUM | public/friends/private |
| avatar_data | TEXT (nullable) | DiceBear SVG 또는 DALL-E Base64 이미지 |
| created_at | DATETIME | 생성 시각 |

### 5.2 CameraSession
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → User |
| lat | FLOAT | 위도 |
| lng | FLOAT | 경도 |
| is_discoverable | BOOLEAN | 탐지 허용 여부 |
| mode | ENUM | normal/penpal/explore |
| started_at | DATETIME | 시작 시각 |
| ended_at | DATETIME | 종료 시각 |

### 5.3 Connection
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| requester_id | UUID | FK → User |
| target_id | UUID | FK → User |
| type | ENUM | friend/temporary |
| status | ENUM | pending/accepted/rejected |
| created_at | DATETIME | 생성 시각 |

### 5.4 Trace
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → User |
| photo_data | TEXT | Base64 이미지 데이터 |
| lat | FLOAT | 위도 |
| lng | FLOAT | 경도 |
| heading | FLOAT | 방향 |
| caption | TEXT | 메모 |
| visibility | ENUM | public/friends/private |
| created_at | DATETIME | 생성 시각 |

### 5.5 Message
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| session_id | VARCHAR | 채팅 세션 ID |
| sender_id | UUID | FK → User |
| original_text | TEXT | 원문 |
| translated_text | TEXT | 번역문 |
| language_code | VARCHAR(10) | 원문 언어 |
| created_at | DATETIME | 생성 시각 |

---

## 6. API 엔드포인트

### 6.1 인증
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/auth/register | 닉네임 기반 간편 가입 |
| POST | /api/auth/login | 로그인 (닉네임 + user_id) |

### 6.2 사용자
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/users/me | 내 정보 조회 |
| PUT | /api/users/me | 내 정보 수정 |
| GET | /api/users/nearby | 주변 사용자 목록 |
| POST | /api/users/{id}/default-avatar | DiceBear 무료 아바타 자동 생성 (로그인 시 호출) |
| POST | /api/users/{id}/generate-avatar | DALL-E 2 AI 아바타 수동 생성 |

### 6.3 연결
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/connections/request | 친구 요청 |
| PUT | /api/connections/{id}/accept | 수락 |
| PUT | /api/connections/{id}/reject | 거절 |
| GET | /api/connections | 내 연결 목록 |

### 6.4 흔적
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/traces | 흔적 생성 |
| GET | /api/traces | 내 흔적 목록 |
| GET | /api/traces/nearby | 주변 공개 흔적 |
| GET | /api/traces/friends | 친구 흔적 |
| DELETE | /api/traces/{id} | 흔적 삭제 |

### 6.5 AI 탐험 큐레이션
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/explore/recommend | GPT-4o-mini 기반 장소 추천 (my_style / friend_vibe / mood 3가지 유형) |

**GPT 입력 데이터:**
- 내 흔적 최근 4개 (장소 좌표 + 메모)
- 친구 흔적 최근 1개 (반경 5km 이내)
- 근처 공개 흔적 (반경 3km 이내)
- 현재 시간대 (아침/점심/오후/저녁/밤)
- 흔적 0개인 경우에도 현재 위치 기반 장소 추천

### 6.6 WebSocket
| Endpoint | 설명 |
|----------|------|
| /ws/nearby/{user_id} | 주변 사용자 실시간 탐지 (heading 파라미터 포함) |
| /ws/chat/{session_id} | 실시간 채팅 + MyMemory 자동 번역 |

---

## 7. 화면 구성

### 7.1 메인 카메라 화면
- 웹캠 프리뷰 전체 화면
- **AR 아바타 오버레이**: 주변 사용자를 나침반 방위각(DeviceOrientationEvent) 기반으로 화면 좌우에 배치
  - 아바타 이미지 (DiceBear 또는 DALL-E) + 닉네임 + 거리 표시
  - 방향이 없는 경우 거리 순 정렬
- 촬영 버튼, 모드 전환 (일반/펜팔/탐험)
- 사진 촬영 시 위치 메타데이터 자동 수집

### 7.2 지도 화면
- Leaflet.js 기반 전체 화면 다크맵 (CartoCDN)
- 내 흔적 마커 (파란색), 친구 흔적 마커 (주황색), 공개 흔적 마커 (초록색)
- 마커 클릭 시 사진/메모 팝업
- **AI 탐험 패널** (🧭 버튼 → 바텀시트):
  - 3가지 추천 유형: 🌸 내 취향 스팟 / 👥 근처 감성 스팟 / ✨ 지금 딱 맞는 곳
  - 각 추천 항목 클릭 시 지도에 핑크 펄스 마커 표시
  - 흔적 없어도 현재 위치 + 시간대 기반 추천

### 7.3 채팅 화면
- 실시간 메시지 목록 (원문 + 번역문 동시 표시)
- **세션 없는 경우 빈 화면 안내**: "📷 카메라 화면에서 주변 사용자를 탭하거나 친구 목록에서 대화를 시작하세요"
- 세션 종료 버튼

### 7.4 프로필/연결 화면
- 닉네임, 언어 설정, 공개 범위 설정
- **AI 아바타 표시**: 로그인 시 자동 생성된 DiceBear 아바타 또는 DALL-E 생성 아바타
- **🎨 DALL-E AI 아바타 생성 버튼**: 수동으로 닉네임 기반 AI 캐릭터 생성
- 친구 목록, 연결 요청 알림

---

## 8. 보안 요구사항

- 위치 공개는 opt-in (기본값: 비공개)
- 친구 추가는 상호 동의 필수
- 임시 세션은 24시간 후 자동 만료
- 입력값 sanitization (XSS/Injection 방지)
- CORS 설정을 통한 접근 제어
- OpenAI API 키는 `.env` 파일에 보관, `.gitignore`로 Git 추적 제외
- HTTPS (self-signed cert) 로컬 테스트 환경, 모바일 카메라/위치 권한 대응
- `cert.pem`, `key.pem`은 `.gitignore`에 포함

---

## 9. 프로젝트 구조

```
coco/
├── main.py                 # FastAPI 서버 진입점 + 전체 API
├── database.py             # DB 설정 및 세션
├── models.py               # SQLAlchemy 모델 (avatar_data 포함)
├── requirements.txt        # Python 의존성
├── .env                    # API 키 관리 (OPENAI_API_KEY)
├── .gitignore              # .env, *.pem, __pycache__, coco.db, venv/ 제외
├── specification.md        # 기술 명세서 (본 문서)
├── basic_specifiaction.md  # 서비스 기획 초안
├── service_ideation_summary.md
├── static/
│   ├── css/
│   │   └── style.css       # 전체 스타일 (AR 오버레이, 탐험 패널, 프로필 아바타)
│   └── js/
│       ├── app.js          # 메인 앱 컨트롤러 (아바타, AR, 탐험 포함)
│       ├── camera.js       # 카메라 모듈
│       ├── map.js          # 지도 모듈 (탐험 마커 포함)
│       ├── chat.js         # 채팅 모듈
│       └── nearby.js       # 주변 탐지 모듈 (나침반 헤딩 포함)
└── templates/
    └── index.html          # SPA 메인 페이지 (JS ?v=4)
```

---

## 10. 실행 방법

```bash
# 로컬 HTTPS 서버 (모바일 테스트용)
cd /Users/user/Documents/Workspace/coco
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 \
  --ssl-keyfile key.pem --ssl-certfile cert.pem --reload
```

- 로컬 접속: `https://localhost:8000`
- 동일 WiFi 모바일: `https://192.168.0.53:8000`
- 브라우저에서 인증서 경고 → "고급" → "안전하지 않음으로 이동" 클릭

> **무한 리디랙션 발생 시**: 브라우저 시크릿 창 사용 또는 `chrome://net-internals/#hsts`에서 HSTS 캐시 삭제

---

## 11. AI 기능 상세

### 11.1 AI 아바타 (DiceBear - 자동)
- 로그인 시 `POST /api/users/{id}/default-avatar` 자동 호출
- DiceBear API v8: `https://api.dicebear.com/8.x/bottts/svg?seed={nickname}`
- SVG를 Base64로 인코딩하여 `users.avatar_data`에 저장
- 비용 없음 (무료 외부 API)

### 11.2 AI 아바타 (DALL-E 2 - 수동)
- 프로필 화면 "🎨 DALL-E AI 아바타 생성" 버튼 클릭 시 호출
- 닉네임 기반 프롬프트: `"cute cartoon avatar character for user named '{nickname}'"`
- 256×256 이미지, Base64 저장
- OpenAI billing 한도에 따라 사용 가능

### 11.3 AI 탐험 큐레이션 (GPT-4o-mini)
- `GET /api/explore/recommend?user_id=...&lat=...&lng=...`
- **GPT 입력 데이터**:
  - 내 흔적 최근 **4개** (장소 + 메모)
  - 친구 흔적 최근 **1개** (반경 5km)
  - 근처 공개 흔적 (반경 3km)
  - 현재 시간대 컨텍스트 (5단계 분류)
- **출력**: 3가지 추천 유형 (my_style / friend_vibe / mood), 각 2~3개 장소
- 흔적 없을 때: 현재 위치 ±0.003~0.008 범위 내 시간대 맞는 장소 추천
- 응답 형식: JSON (lat, lng, label, reason, emoji)
