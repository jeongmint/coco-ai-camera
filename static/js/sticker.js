/**
 * COCO Sticker & Time Filter Module
 * time-camera-ai의 AI 스티커 생성 + 시간 여행 필터 기능 통합
 */
const StickerModule = (() => {

    // ── Season Filters ───────────────────────────────────────────────────────
    const SEASONS = [
        { id: 'none',     label: '원본',  icon: '📷', cssFilter: '',                                                                            overlayColor: null },
        { id: 'spring',   label: '봄',    icon: '🌸', cssFilter: 'saturate(1.3) brightness(1.1) hue-rotate(-10deg)',                            overlayColor: 'rgba(255,182,193,0.22)' },
        { id: 'summer',   label: '여름',  icon: '☀️', cssFilter: 'saturate(1.5) brightness(1.15) contrast(1.1) sepia(0.1)',                     overlayColor: 'rgba(255,200,0,0.12)' },
        { id: 'autumn',   label: '가을',  icon: '🍂', cssFilter: 'saturate(1.2) sepia(0.3) brightness(1.0) contrast(1.05)',                     overlayColor: 'rgba(180,80,20,0.18)' },
        { id: 'winter',   label: '겨울',  icon: '❄️', cssFilter: 'saturate(0.6) brightness(1.15) contrast(1.05) hue-rotate(10deg)',             overlayColor: 'rgba(200,220,255,0.28)' },
        { id: 'past1960', label: '1960s', icon: '🎞️', cssFilter: 'grayscale(0.85) contrast(1.3) brightness(0.95) sepia(0.2)',                   overlayColor: 'rgba(80,60,40,0.22)' },
        { id: 'past1980', label: '1980s', icon: '📼', cssFilter: 'saturate(1.6) contrast(1.2) brightness(1.05) hue-rotate(15deg)',              overlayColor: 'rgba(255,0,128,0.12)' },
        { id: 'future',   label: '2050',  icon: '🚀', cssFilter: 'saturate(1.4) brightness(1.1) contrast(1.15) hue-rotate(30deg)',              overlayColor: 'rgba(0,255,200,0.12)' },
        { id: 'night',    label: '한밤',  icon: '🌙', cssFilter: 'brightness(0.55) saturate(0.7) contrast(1.2) hue-rotate(220deg)',             overlayColor: 'rgba(10,10,60,0.4)' },
    ];

    // ── Sticker Concepts (from time-camera-ai — all 14) ─────────────────────
    const ANIMAL_LIST = 'raccoon, quokka, dog, cat, lion, tiger, bear, goat, sheep, otter, penguin, owl, chick, squirrel, rabbit, wolf, fox, deer, hamster, duck, mouse, hedgehog, panda, chinchilla, capybara, badger, alpaca, ferret, meerka, sloth, gazelle, beaver';
    const ANIMAL_PICK = `Choose ONE animal from this list: ${ANIMAL_LIST}. Base your choice primarily on the person's physical appearance, face shape, and overall vibe — NOT always a cat.`;

    const CONCEPTS = [
        {
            id: 'everskies',
            label: 'Everskies',
            icon: '🎮',
            color: '#ff6eb4',
            desc: '픽셀 아트 패션',
            visionPrompt: `Describe the person's hair color/style, face shape, skin tone, and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `Render in Everskies pixel art style. Person appearance: [DESCRIPTION]. Crisp pixel-perfect sprite, pastel palette with jewel-tone accents, kawaii chibi proportions, small highlight pixels on eyes. Full body front-facing. Completely transparent background, isolated subject only, no floor shadow, no backdrop whatsoever.`,
        },
        {
            id: 'acornzzi',
            label: '도토리찌',
            icon: '🌰',
            color: '#f4a261',
            desc: '동물 치비 캐릭터',
            visionPrompt: `Describe the person's hair color/style, face shape, skin tone, and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `IMPORTANT: Do NOT draw a human. ${ANIMAL_PICK} Then draw that animal character in Acornzzi Korean webtoon chibi style. Person appearance: [DESCRIPTION]. Give the animal: the person's hair color and hairstyle on top of its head, and a simplified version of their outfit. Style: extremely round puffy cloud-like body, oversized glossy dewy eyes, dreamy soft airy pastel colors (cotton candy pink, baby lavender, pale mint, creamy peach), outline strokes must be noticeably darker and more saturated than the fill color to define shapes clearly, soft feathery shading with no harsh edges, gentle rosy blush marks, all shapes pillowy and fluffy. Completely transparent background, isolated subject only, no floor or backdrop.`,
        },
        {
            id: 'animalcrossing',
            label: '동물의숲',
            icon: '🍃',
            color: '#52b788',
            desc: '코지 3D',
            visionPrompt: `Describe the person's hair color/style, face shape, skin tone, and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `Render in Animal Crossing 3D Nintendo style with chibi proportions. Person appearance: [DESCRIPTION]. Large round head, very short compact body (3:1 head-to-body ratio), stubby limbs, full body front-facing. Soft 3D rounded forms with gentle subsurface shading, warm pastel earthy tones, smooth plump volumes. Eyes MUST be extremely simple — small flat oval or circle shape, solid single color with NO iris detail, NO catchlight, NO glossy sheen, NO multi-layered effects, just a plain cute minimal dot-like eye in one solid dark color, exactly like real Animal Crossing villager eyes. Small simple round nose. Cozy warm lighting, ambient occlusion in crevices. Completely transparent background, isolated subject only.`,
        },
        {
            id: 'leeslow',
            label: 'Leeslow',
            icon: '🎨',
            color: '#ff9ecb',
            desc: '거친 아크릴 페인팅',
            visionPrompt: `Describe the person's hair color/style, face shape, skin tone, and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `IMPORTANT: Do NOT draw a human. ${ANIMAL_PICK} Paint that animal as a naive acrylic painting character. Person appearance: [DESCRIPTION]. Give the animal the person's hair color/style and a simplified version of their outfit. Style: childlike proportions, thick impasto paint strokes, rough messy brush texture, uneven hand-painted colors, playful and imperfect expression, paint splashes and drips, hand-painted canvas look, no realism, no 3D, flat painting style. Completely transparent background, isolated subject only.`,
        },
        {
            id: 'teenieping',
            label: '티니핑',
            icon: '🩷',
            color: '#ff85c2',
            desc: '마법 요정 3D',
            visionPrompt: `Describe the person's hair color/style, face shape, skin tone, and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `Transform the person into a magical animal fairy character in Teenieping HeartLing style. ${ANIMAL_PICK} Person appearance: [DESCRIPTION]. The animal's face/body must be a bright pastel color (hot pink #ffb3d9, yellow #ffe066, or sky blue #99ddff). Large round head (4:1 ratio) on tiny chubby body. Large 3D glossy eyes with vivid iris and very pale ivory sclera (#faf5e4 — not pure white). Extravagant colorful hair matching person's hair with holographic rainbow streaks. Mandatory sparkly gem crown or tiara on head. At least 3–4 hair accessories (star pins, heart clips, ribbons, flower pins). Large iridescent holographic butterfly wings. Preserve the person's hair color and outfit. Rosy cheeks, small cute mouth. Specular highlight: a soft bright specular shine on the top of the forehead and rounded cheeks — small elongated oval highlight, pale yellow-white, as if lit from above-left, giving the smooth surface a gentle glossy vinyl sheen. Completely transparent background.`,
        },
        {
            id: 'disney',
            label: '디즈니',
            icon: '✨',
            color: '#ffd166',
            desc: '디즈니 애니메이션',
            visionPrompt: `Describe the person's hair color/style, face shape, skin tone, and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `Render in Disney animation style with chibi proportions. Person appearance: [DESCRIPTION]. Oversized round head, small compact body (3:1 head-to-body ratio), short stubby limbs, full body front-facing. Polished smooth cel-shading, large expressive luminous eyes with detailed lashes, clean elegant curves, warm vibrant balanced colors, rim lighting, Disney character charm and cuteness. Completely transparent background, isolated subject only, no backdrop.`,
        },
        {
            id: 'minini',
            label: '미니니 인형',
            icon: '🫧',
            color: '#c9b1ff',
            desc: '빵실 대두 봉제인형',
            visionPrompt: `Describe the person's hair color/style, skin tone, and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `Render the person as a pluffy oversized-head plush doll, not as a flat illustration and not as a plastic toy. Person appearance: [DESCRIPTION]. Extremely large round head with very short wide squishy body (about 4:1 ratio), soft microfiber fur, visible fuzzy fibers, embroidered dot eyes, stitched mouth, rosy cheek patches, short stubby limbs, compact stuffed-animal proportions, pastel toy colors, realistic plush fabric detail, soft studio product lighting. Completely transparent background, isolated subject only.`,
        },
        {
            id: 'peterrabbit',
            label: '올드 색연필',
            icon: '🖍️',
            color: '#a8d5ba',
            desc: '빈티지 색연필 수채화',
            visionPrompt: `Describe the person's hair color/style and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `IMPORTANT: Do NOT draw a human. ${ANIMAL_PICK} Then illustrate that animal in vintage colored pencil and watercolor storybook style. Person appearance: [DESCRIPTION]. Give the animal: the person's hair color and a tiny version of their outfit or clothing style. Style: soft delicate watercolor washes over light pencil sketch lines, pale airy pastel palette (pale sage, dusty rose, butter yellow, powder blue), visible fine hatching, tender nostalgic storybook charm, gentle soft botanical light. Completely transparent background, isolated subject only.`,
        },
        {
            id: 'kimjungyoon',
            label: '블링',
            icon: '✨',
            color: '#b48ef5',
            desc: '몽환 홀로그램 일러스트',
            visionPrompt: `Describe the person's hair color/style, face shape, skin tone, and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `Render as a dreamy ethereal chibi anime character — cute chibi proportions (large round head, small compact body, 3:1 ratio), NOT a mature or realistic figure. Person appearance: [DESCRIPTION]. Iridescent soft pastel color palette (lavender, rose pink, ice blue, pearl white — holographic shimmer throughout). Soft glowing skin with inner luminescence. Large oversized cute chibi anime eyes with detailed iridescent iris, multi-layered sparkle catchlights, wet glossy look — eyes take up a large portion of the face. Rosy tiny nose, small cute mouth, round chubby chibi cheeks. Hair rendered with holographic sheen — light refracts through strands in rainbow pastel tones. Outfit has translucent bubble or crystal material elements, cute and playful silhouette. Floating sparkle particles, soft light orbs, and iridescent petals drifting around the character. Soft rim lighting, painterly high-detail brushwork. Full body front-facing chibi. Completely transparent background, isolated character only.`,
        },
        {
            id: 'powerpuff',
            label: '파워퍼프',
            icon: '💥',
            color: '#ff6b9d',
            desc: '파워퍼프걸 왕대두 카툰',
            visionPrompt: `Describe the person's hair color, hairstyle, and outfit colors in 1-2 English sentences.`,
            imagePrompt: `Redraw this exact person as a Powerpuff Girls character in the OFFICIAL Powerpuff Girls cartoon art style. Person appearance: [DESCRIPTION]. CRITICAL proportions — copy exactly from the show: perfectly circular head that is at least 70% of the entire figure height, with a tiny pill-shaped body, no visible neck, very short stubby arms with no fingers (just rounded stumps), and short stubby legs. The face is a flat circle. Eyes: two large perfect circles side by side taking up most of the face, each eye has a solid colored iris and a black pupil, with a subtle colored reflection dot — NO iris outline ring, NO lashes. Absolutely NO nose. A tiny simple curved line for the mouth. Replicate the person's exact hair color and hairstyle drawn in flat graphic form. Match the person's outfit/clothing colors. All colors are 100% flat solid fills — zero shading, zero gradients, zero texture, zero 3D. Bold thick black outlines on all edges. Classic Powerpuff Girls retro Cartoon Network energy. Completely transparent background, isolated character only.`,
        },
        {
            id: 'maplestory',
            label: '메이플스토리',
            icon: '🍁',
            color: '#ff6600',
            desc: '메이플스토리 픽셀',
            visionPrompt: `Describe the person's hair color/style, skin tone, and outfit in 2-3 concise English sentences for illustration reference.`,
            imagePrompt: `Render as a MapleStory pixel art character sprite. Person appearance: [DESCRIPTION]. Oversized round pixel head taking up most of the height (3:1 head-to-body ratio), very short compact body with stubby legs. Replicate the person's hair color and style as a pixel art hairstyle. Reproduce their outfit colors as a MapleStory-style costume. Eye sclera MUST be very pale cream (#f8f4e8) or pale yellow-white, NOT pure white (#ffffff). Avoid pure white anywhere; any area that would be white must use off-white, pale cream, or pale yellow so it stays visible against transparent background. Simple pixel mouth. The character MUST be holding or equipped with a weapon — randomly choose exactly one of: a glowing magic staff (long rod with orb on top), a bow and arrow, a pair of knuckle dusters, a sword, a giant two-handed axe, a long spear, dual pistols, a throwing star held between fingers, or a massive shoulder-mounted cannon strapped to the character's back and arm. The weapon must be clearly visible and rendered in pixel art style matching the character. Bright vivid MapleStory palette, clean crisp pixel edges, flat sprite shading with pixel highlights. Full body front-facing sprite. Completely transparent background.`,
        },
        {
            id: 'lego',
            label: '레고',
            icon: '🧱',
            color: '#f7b731',
            desc: '레고 미니피규어',
            visionPrompt: `Describe the person's hair color and outfit colors in 1-2 English sentences.`,
            imagePrompt: `Render as LEGO minifigure. Person appearance: [DESCRIPTION]. Classic yellow cylindrical LEGO head with simple printed face (dot eyes, smile arc), replicate the person's hair color as a LEGO hair piece on top, blocky rectangular torso with printed design matching their outfit colors, short cylindrical legs in matching pants color, bright solid primary colors, shiny plastic specular highlights, iconic LEGO toy quality. Completely transparent background, isolated subject only.`,
        },
        {
            id: 'doodle',
            label: '두들',
            icon: '✏️',
            color: '#b5c9a1',
            desc: '연필 낙서 파스텔',
            visionPrompt: `Describe the person's hair color/style and outfit briefly in 1-2 English sentences.`,
            imagePrompt: `IMPORTANT: Do NOT draw a human. ${ANIMAL_PICK} Draw that animal as a hand-drawn pencil doodle sticker. Person appearance: [DESCRIPTION]. Give the animal the person's hair color and a simple version of their outfit. Style: wobbly imperfect pencil sketch outlines — slightly uneven wiggly lines with casual handmade charm, very minimal simple shapes with as few strokes as possible, soft light pastel color fills (pale mint, dusty rose, butter yellow, lavender — washed-out and gentle, loosely inside the lines), almost flat with minimal shading, tiny simple dot eyes, small line mouth, rosy cheek blush marks drawn as two simple circles. The whole result must look like a quick cute doodle sketch drawn by hand. Completely transparent background.`,
        },
        {
            id: 'chiikawa',
            label: '치이카와',
            icon: '🐹',
            color: '#cfe8ff',
            desc: '치이카와 손그림 마스코트',
            visionPrompt: `Describe the person's hair color and face shape briefly in 1-2 English sentences.`,
            imagePrompt: `IMPORTANT: Do NOT draw a human. ${ANIMAL_PICK} Redraw that animal as a tiny round Chiikawa-style hand-drawn mascot. Person appearance: [DESCRIPTION]. Give it the person's hair color and a simple version of their outfit. Style: extremely round mochi-like body with 1:1 head-to-body ratio (nearly all head), very small rounded ears, tiny bean-like black eyes spaced far apart, tiny dot or triangular nose, faint pink blush cheeks, wobbly uneven black contour lines with slightly unclosed edges, flat simple pastel coloring, soft off-white or pastel body color, innocent slightly clueless expression, children's picture-book feeling, 2D only, absolutely flat single-tone color fills with ZERO shading, ZERO shadow, ZERO gradient, ZERO texture — each area must be one solid flat color only, like a simple coloring-book filled with a single crayon stroke. No dark patches, no uneven blotches, no depth. Completely transparent background.`,
        },
    ];

    // ── State ────────────────────────────────────────────────────────────────
    let activeSeason = SEASONS[0];
    let activeConcept = null;
    let isGenerating = false;
    let capturedPhotoDataUrl = null;

    // ── DOM refs (resolved after init) ──────────────────────────────────────
    let capturedImage;

    // ── Init ─────────────────────────────────────────────────────────────────
    function init() {
        capturedImage = document.getElementById('captured-image');
        _renderSeasonRow();
        _renderConceptGrid();
        _bindStickerToggle();
    }

    // Called by app.js every time a new photo is captured
    function setCapturedPhoto(dataUrl) {
        capturedPhotoDataUrl = dataUrl;
        activeSeason = SEASONS[0];
        activeConcept = null;

        // Reset season UI
        document.querySelectorAll('.season-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.season === 'none')
        );
        if (capturedImage) capturedImage.style.filter = '';
        const overlay = document.getElementById('season-overlay');
        if (overlay) overlay.style.background = 'transparent';

        // Reset sticker UI
        const panel = document.getElementById('ai-sticker-panel');
        if (panel) panel.classList.add('hidden');
        const toggleBtn = document.getElementById('sticker-toggle-btn');
        if (toggleBtn) toggleBtn.classList.remove('active');
        document.querySelectorAll('.concept-btn').forEach(b => b.classList.remove('active'));
        const genBtn = document.getElementById('gen-person-btn');
        if (genBtn) genBtn.disabled = true;
        _clearStickerOutput();
    }

    // ── Season Filter ────────────────────────────────────────────────────────
    function _renderSeasonRow() {
        const container = document.getElementById('season-filter-row');
        if (!container) return;
        container.innerHTML = SEASONS.map(s =>
            `<button class="season-btn${s.id === 'none' ? ' active' : ''}" data-season="${s.id}" title="${s.label}">
                <span class="season-icon">${s.icon}</span>
                <span class="season-label">${s.label}</span>
            </button>`
        ).join('');
        container.addEventListener('click', e => {
            const btn = e.target.closest('.season-btn');
            if (!btn) return;
            const season = SEASONS.find(s => s.id === btn.dataset.season);
            if (!season) return;
            activeSeason = season;
            if (capturedImage) capturedImage.style.filter = season.cssFilter;
            const overlay = document.getElementById('season-overlay');
            if (overlay) overlay.style.background = season.overlayColor || 'transparent';
            container.querySelectorAll('.season-btn').forEach(b =>
                b.classList.toggle('active', b === btn)
            );
        });
    }

    // ── Sticker Panel ────────────────────────────────────────────────────────
    function _renderConceptGrid() {
        const grid = document.getElementById('concept-grid');
        if (!grid) return;
        grid.innerHTML = CONCEPTS.map(c =>
            `<button class="concept-btn" data-concept="${c.id}" style="--concept-color:${c.color}">
                <span class="concept-icon">${c.icon}</span>
                <span class="concept-label">${c.label}</span>
                <span class="concept-desc">${c.desc}</span>
            </button>`
        ).join('');
        grid.addEventListener('click', e => {
            const btn = e.target.closest('.concept-btn');
            if (!btn) return;
            activeConcept = CONCEPTS.find(c => c.id === btn.dataset.concept) || null;
            grid.querySelectorAll('.concept-btn').forEach(b =>
                b.classList.toggle('active', b === btn)
            );
            const genBtn = document.getElementById('gen-person-btn');
            if (genBtn) genBtn.disabled = !activeConcept;
        });
    }

    function _bindStickerToggle() {
        document.addEventListener('click', e => {
            if (e.target.id === 'sticker-toggle-btn') {
                const panel = document.getElementById('ai-sticker-panel');
                if (panel) panel.classList.toggle('hidden');
                e.target.classList.toggle('active');
            }
            if (e.target.id === 'gen-person-btn') {
                _generatePersonSticker();
            }
            if (e.target.id === 'sticker-download-btn') {
                const url = e.target.dataset.url;
                if (url) _downloadSticker(url);
            }
            if (e.target.id === 'sticker-attach-btn') {
                const url = e.target.dataset.url;
                if (url) _attachStickerToPhoto(url);
            }
        });
    }

    // ── Sticker Generation ───────────────────────────────────────────────────
    async function _generatePersonSticker() {
        if (isGenerating) return;
        if (!activeConcept) { _toast('스티커 스타일을 먼저 선택해주세요', 'error'); return; }
        if (!capturedPhotoDataUrl) { _toast('사진이 없습니다', 'error'); return; }

        isGenerating = true;
        _setLoadingUI(true);
        _clearStickerOutput();

        try {
            // Step 1: GPT-4o Vision — person description
            const visionResp = await fetch('/api/sticker/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    photo_data: capturedPhotoDataUrl,
                    prompt: activeConcept.visionPrompt,
                }),
            });
            const visionData = await visionResp.json();
            if (!visionResp.ok) throw new Error(visionData.detail || 'Vision 분석 실패');
            const description = visionData.description || 'the person in the photo';

            // Step 2: Build final image prompt
            const prompt = activeConcept.imagePrompt.replace('[DESCRIPTION]', description);

            // Step 3: gpt-image-1.5 sticker generation
            const genResp = await fetch('/api/sticker/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    photo_data: capturedPhotoDataUrl,
                    prompt,
                }),
            });
            const genData = await genResp.json();
            if (!genResp.ok) throw new Error(genData.detail || '스티커 생성 실패');

            _showStickerResult(genData.sticker_data);
            _toast(`${activeConcept.label} 스티커 완성! ✨`, 'success');
        } catch (err) {
            console.error('Sticker generation error:', err);
            _toast(err.message || '스티커 생성에 실패했습니다', 'error');
        } finally {
            isGenerating = false;
            _setLoadingUI(false);
        }
    }

    function _showStickerResult(dataUrl) {
        const output = document.getElementById('sticker-output');
        if (!output) return;
        output.classList.remove('hidden');
        output.innerHTML = `
            <div class="sticker-result">
                <img src="${dataUrl}" class="sticker-result-img" alt="AI 스티커">
                <div class="sticker-result-actions">
                    <button class="btn btn-secondary btn-sm" id="sticker-download-btn" data-url="${dataUrl}">⬇️ 저장</button>
                    <button class="btn btn-primary btn-sm" id="sticker-attach-btn" data-url="${dataUrl}">📌 사진에 붙이기</button>
                </div>
            </div>`;
    }

    function _downloadSticker(dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `coco-sticker-${Date.now()}.png`;
        a.click();
    }

    function _attachStickerToPhoto(stickerUrl) {
        if (!capturedPhotoDataUrl) return;
        const photoImg = new Image();
        photoImg.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = photoImg.width;
            canvas.height = photoImg.height;
            const ctx = canvas.getContext('2d');

            // Draw season-filtered photo
            if (activeSeason.cssFilter) ctx.filter = activeSeason.cssFilter;
            ctx.drawImage(photoImg, 0, 0);
            ctx.filter = 'none';

            // Apply color overlay if any
            if (activeSeason.overlayColor) {
                ctx.fillStyle = activeSeason.overlayColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Draw sticker at bottom-right (30% of width)
            const stickerImg = new Image();
            stickerImg.onload = () => {
                const size = Math.round(photoImg.width * 0.3);
                const margin = Math.round(photoImg.width * 0.04);
                ctx.drawImage(stickerImg, photoImg.width - size - margin, photoImg.height - size - margin, size, size);

                const composited = canvas.toDataURL('image/jpeg', 0.9);
                capturedPhotoDataUrl = composited;
                activeSeason = SEASONS[0];  // filter baked in, reset state

                if (capturedImage) {
                    capturedImage.src = composited;
                    capturedImage.style.filter = '';
                }
                const overlay = document.getElementById('season-overlay');
                if (overlay) overlay.style.background = 'transparent';
                document.querySelectorAll('.season-btn').forEach(b =>
                    b.classList.toggle('active', b.dataset.season === 'none')
                );

                _toast('스티커가 사진에 붙여졌습니다 ✨', 'success');
            };
            stickerImg.src = stickerUrl;
        };
        photoImg.src = capturedPhotoDataUrl;
    }

    function _clearStickerOutput() {
        const output = document.getElementById('sticker-output');
        if (output) { output.innerHTML = ''; output.classList.add('hidden'); }
    }

    function _setLoadingUI(loading) {
        const btn = document.getElementById('gen-person-btn');
        const spinner = document.getElementById('sticker-spinner');
        if (btn) {
            btn.disabled = loading;
            btn.textContent = loading ? '⏳ 생성 중...' : '✨ 캐릭터 스티커 생성';
        }
        if (spinner) spinner.classList.toggle('hidden', !loading);
    }

    function _toast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Returns Promise<string> — photo data URL with season filter baked in.
     * If no filter active, resolves with the original captured photo data URL.
     */
    function getFilteredPhotoData() {
        return new Promise((resolve) => {
            if (!capturedPhotoDataUrl) return resolve(null);
            if (!activeSeason || !activeSeason.cssFilter) return resolve(capturedPhotoDataUrl);

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.filter = activeSeason.cssFilter;
                ctx.drawImage(img, 0, 0);
                if (activeSeason.overlayColor) {
                    ctx.filter = 'none';
                    ctx.fillStyle = activeSeason.overlayColor;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = () => resolve(capturedPhotoDataUrl);
            img.src = capturedPhotoDataUrl;
        });
    }

    return { init, setCapturedPhoto, getFilteredPhotoData };
})();
