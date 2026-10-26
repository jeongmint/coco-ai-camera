# COCO 프로젝트 요약

> **COCO** (일본어 ここ = "이곳") — 카메라를 친구 추가·장소 기반 소셜 인터페이스로 확장한 **위치 기반 카메라 SNS 웹 서비스 (MVP)**
> 번호·아이디·QR 교환 없이, 카메라를 켜는 순간 주변의 사람·장소·흔적이 연결되는 경험을 목표로 한다.

## 핵심 컨셉
1. **카메라 기반 소셜 연결** — 서로 카메라를 켜면 에어드랍처럼 주변 사용자와 연결, 친구 추가/임시 세션
2. **지도 기반 흔적 기록** — 사진·메모를 장소에 남겨 지도를 추억 갤러리이자 친구의 흔적 탐험 공간으로
3. **AI 기반 AR 아바타** — AI 아바타 생성 및 카메라 화면 위 AR 오버레이

## 주요 기능 (MVP, 모두 구현 완료)
| # | 기능 | 구현 방식 |
|---|------|-----------|
| F1 | 주변 사용자 탐지 | WebRTC 카메라 + Geolocation, WebSocket `/ws/nearby`, Haversine 거리 계산 |
| F2 | 친구 요청 / 임시 연결 | `/api/connections` (요청·수락·거절) |
| F3 | 펜팔 번역 채팅 | WebSocket `/ws/chat` + MyMemory 번역 API |
| F4 | 위치 기반 사진 기록 | 좌표·시간·방향과 함께 Trace 저장 |
| F5 | 지도 흔적 탐색 | Leaflet.js + CartoCDN 다크맵 |
| F6 | 공개 범위 설정 | 흔적 단위 public / friends / private |
| F7 | AR 나침반 아바타 | 방위각 기반 주변 사용자 아바타 오버레이 |
| F8 | AI 아바타 | DiceBear 자동 생성 + DALL·E 2 수동 생성 |
| F9 | AI 탐험 큐레이션 | GPT-4o-mini 기반 개인화 장소 추천 (최대 3곳) |
| + | **AI 스티커 & 타임 필터** | time-camera-ai 통합: 계절/시대 필터 9종, 스티커 컨셉 14종, GPT-4o Vision 장면 분석 → gpt-image-1.5 투명 PNG 스티커 |

## 기술 스택
- **Backend**: Python FastAPI (REST + WebSocket), Uvicorn
- **DB**: SQLite (`coco.db`) + SQLAlchemy
- **Frontend**: HTML/CSS/Vanilla JS (`templates/`, `static/`) + `/sticker` 경로의 React 빌드(`time-camera-build/`)
- **외부 API**: OpenAI (GPT-4o, GPT-4o-mini, DALL·E 2, gpt-image-1.5), DiceBear, MyMemory
- **기타**: python-dotenv(`.env`로 API 키 관리), self-signed HTTPS(`cert.pem`/`key.pem`, 모바일 카메라·위치 권한용)

## 디렉터리 구조
```
coco/
├── main.py            # FastAPI 앱: 전체 API·WebSocket·스티커 엔드포인트 (~930줄)
├── models.py          # ORM 모델: User, CameraSession, Connection, Trace, Message
├── database.py        # DB 엔진/세션 설정
├── templates/index.html
├── static/
│   ├── css/style.css
│   └── js/  app.js · camera.js · nearby.js · chat.js · map.js · sticker.js
├── time-camera-build/ # time-camera-ai React 앱 빌드 산출물 (/sticker 에서 서빙)
├── specification.md · basic_specifiaction.md · service_ideation_summary.md  # 기획/명세 문서
└── requirements.txt
```

## 주요 API
| 영역 | 엔드포인트 |
|------|-----------|
| 인증 | `POST /api/auth/register`, `POST /api/auth/login` |
| 사용자 | `GET/PUT /api/users/{id}`, `POST .../default-avatar`, `POST .../generate-avatar`, `GET /api/users/nearby/list` |
| 연결 | `POST /api/connections/request`, `PUT /api/connections/{id}/accept\|reject`, `GET /api/connections` |
| 흔적 | `POST/GET /api/traces`, `GET /api/traces/nearby`, `GET /api/traces/friends`, `DELETE /api/traces/{id}` |
| 실시간 | `WS /ws/nearby/{user_id}`, `WS /ws/chat/{session_id}`, `GET /api/chat/{session_id}/messages` |
| AI | `GET /api/explore/recommend`, `POST /api/sticker/vision`, `POST /api/sticker/generate` |
| 페이지 | `GET /` (메인 앱), `GET /sticker` (React 스티커 앱) |

## 실행
```bash
pip install -r requirements.txt
python main.py   # 0.0.0.0:8000, reload 모드
```
`.env`에 `OPENAI_API_KEY` 필요 (없으면 AI 기능은 503 반환).

## 제외(후순위) 범위
얼굴 합성·단체사진 보정, 고도화 AR 이펙트, 여행 동선 자동 생성, 대규모 익명 커뮤니티

## 최근 작업 (브랜치 `time-update`)
- time-camera-ai 스티커·타임 필터 COCO에 통합, 14개 스티커 컨셉 복원
- React 앱을 FastAPI `/sticker`로 서빙
- 장면 분석을 실제 사진 기반 GPT-4o Vision으로 변경
