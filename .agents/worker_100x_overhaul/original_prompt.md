# Original User Request

## 2026-05-28T15:35:35Z

You are a Code Implementation Worker.
Your mission is to perform code changes for FnB-Container-Caffe '100X Premium Hybrid Overhaul' and run build/test verifications.

Target Working Directory: /Users/mac/mekong-cli/FnB-Container-Caffe

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. Integrity violations WILL be detected and your work WILL be rejected.

Detailed Tasks:
1. Update `/Users/mac/mekong-cli/FnB-Container-Caffe/index.html` lines 463-465 in `<section class="cta-section" id="cta">` to:
   - Line 463: `<div class="cta-info-item" role="listitem">📍 27 Nguyễn Tất Thành, Phường 1</div>`
   - Line 464: `<div class="cta-info-item" role="listitem">🕐 T2-T5: 07:00-22:00 | T6-CN: 06:00-23:00</div>`
   - Line 465: `<div class="cta-info-item" role="listitem">📞 0946 013 633</div>`

2. Update `/Users/mac/mekong-cli/FnB-Container-Caffe/dang-ky-thanh-vien.html` line 254 phone number placeholder to:
   - `placeholder="0946 013 633"`

3. Verify that there are absolutely no references to 'view đồng lúa' or 'view sông trực tiếp' in any active source files. Use grep search.

4. Replace the entire space-tabs and space-panes in `/Users/mac/mekong-cli/FnB-Container-Caffe/index.html` (lines 191-195 and 199-361) to put the correct Bazi-aligned zone details. Use `replace_file_content` to make these changes precisely.

Here is the exact replacement content for the space-tabs (lines 191-195):
```html
            <button class="space-tab-btn active" role="tab" aria-selected="true" aria-controls="pane-1" id="tab-1">Quầy Bar "Mộc Zone" (Jade Counter)</button>
            <button class="space-tab-btn" role="tab" aria-selected="false" aria-controls="pane-2" id="tab-2">Rooftop "Thủy Stage" (Sky Deck)</button>
            <button class="space-tab-btn" role="tab" aria-selected="false" aria-controls="pane-3" id="tab-3">Container Seating (Noir Cabin)</button>
            <button class="space-tab-btn" role="tab" aria-selected="false" aria-controls="pane-4" id="tab-4">Sunset Corner (Aura Lounge)</button>
            <button class="space-tab-btn" role="tab" aria-selected="false" aria-controls="pane-5" id="tab-5">VIP Steel Nest</button>
```

And here is the exact replacement content for the space-panes (lines 199-361):
```html
        <!-- Zone 1 -->
        <div class="space-pane active" id="pane-1" role="tabpanel" aria-labelledby="tab-1">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">🪴</div>
                    <span class="space-visual-badge">JADE COUNTER</span>
                </div>
            </div>
            <div class="space-info">
                <h4>Quầy Bar "Mộc Zone" — Jade Counter</h4>
                <p class="space-tagline">Phong Thủy & Tự Nhiên</p>
                <p class="space-desc">Nằm cuối bên phải tầng trệt, quầy container 20ft được chế tác tinh xảo từ gỗ óc chó (walnut) cao cấp kết hợp mặt đá ngọc bích sang trọng. Bao quanh bởi các chậu cây xanh tươi mát, không gian này mang tính Mộc tự nhiên giúp điều hòa và hóa giải hướng Nam (Hỏa), đem lại cảm giác thanh mát và bình an.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Thiết kế</div>
                        <div class="spec-val">Walnut & Jade (Gỗ & Đá Ngọc)</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">15 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Vật liệu</div>
                        <div class="spec-val">Gỗ óc chó & Đá ngọc bích</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Ý nghĩa</div>
                        <div class="spec-val">Cân bằng ngũ hành (Mộc hóa Fire)</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Zone 2 -->
        <div class="space-pane" id="pane-2" role="tabpanel" aria-labelledby="tab-2">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">🚢</div>
                    <span class="space-visual-badge">SKY DECK</span>
                </div>
            </div>
            <div class="space-info">
                <h4>Rooftop "Thủy Stage" — Sky Deck</h4>
                <p class="space-tagline">Khoáng Đạt & Lộng Gió</p>
                <p class="space-desc">Sân thượng container tầng 2 thoáng đãng và lộng gió, ngắm trọn vẹn cảnh trời đêm phố thị Sa Đéc lung linh. Nơi đây mang hành Thủy khoáng đạt, lý tưởng để bạn thưởng thức ly Cold Brew mát lạnh và đắm mình trong không gian lãng mạn vô tận.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Độ cao</div>
                        <div class="spec-val">8 mét so với mặt phố Hùng Vương</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">40 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Không gian</div>
                        <div class="spec-val">Rooftop ngoài trời</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Tầm nhìn</div>
                        <div class="spec-val">Phố thị Sa Đéc lung linh</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Zone 3 -->
        <div class="space-pane" id="pane-3" role="tabpanel" aria-labelledby="tab-3">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">🛋️</div>
                    <span class="space-visual-badge">NOIR CABIN</span>
                </div>
            </div>
            <div class="space-info">
                <h4>Container Seating — Noir Cabin</h4>
                <p class="space-tagline">Ấm Cúng & Công Nghiệp</p>
                <p class="space-desc">Không gian phòng lạnh khép kín bên trong container 40ft ấm cúng. Thiết kế vách thép công nghiệp đen rỉ tự nhiên thô mộc, kết hợp hài hòa với những dãy sofa da màu navy sang trọng mang âm hưởng cổ điển, mang lại sự riêng tư tối đa.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Tiện nghi</div>
                        <div class="spec-val">Điều hòa mát lạnh & Cách âm</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">25 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Kết cấu</div>
                        <div class="spec-val">Vỏ container 40ft nguyên khối</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Vật liệu</div>
                        <div class="spec-val">Thép đen rỉ & Da navy</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Zone 4 -->
        <div class="space-pane" id="pane-4" role="tabpanel" aria-labelledby="tab-4">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">🌅</div>
                    <span class="space-visual-badge">AURA LOUNGE</span>
                </div>
            </div>
            <div class="space-info">
                <h4>Sunset Corner — Aura Lounge</h4>
                <p class="space-tagline">Tây Hướng Hoàng Hôn</p>
                <p class="space-desc">Tọa lạc tại góc phía Tây đón trọn vẹn ánh hoàng hôn rực rỡ, Aura Lounge sử dụng các vật liệu inox gương, chrome bóng bẩy phản chiếu ánh sáng cực chất. Không gian mang tính Kim mạnh mẽ, tương sinh thúc đẩy hành Thủy chủ đạo của quán.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Thời điểm vàng</div>
                        <div class="spec-val">16:30 - 18:00 (Hoàng hôn)</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">20 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Vật liệu</div>
                        <div class="spec-val">Inox gương & Chrome bóng</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Tương sinh</div>
                        <div class="spec-val">Kim sinh Thủy (Tây hướng)</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Zone 5 -->
        <div class="space-pane" id="pane-5" role="tabpanel" aria-labelledby="tab-5">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">💎</div>
                    <span class="space-visual-badge">VIP STEEL NEST</span>
                </div>
            </div>
            <div class="space-info">
                <h4>VIP Steel Nest — Ban Công Treo</h4>
                <p class="space-tagline">Yên Tĩnh & Độc Bản</p>
                <p class="space-desc">Góc ban công container treo lơ lửng ngoài không gian, kiến tạo trải nghiệm lơ lửng độc bản giữa không trung. Phân khu biệt lập mang tính riêng tư cao, thích hợp cho các buổi gặp gỡ đối tác hay những cuộc trò chuyện sâu lắng.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Vị trí</div>
                        <div class="spec-val">Ban công container treo lửng</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">10 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Đặc điểm</div>
                        <div class="spec-val">Biệt lập & Yên tĩnh tuyệt đối</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Thiết kế</div>
                        <div class="spec-val">Thép công nghiệp xám & Kính</div>
                    </div>
                </div>
            </div>
        </div>
```

5. Run `npm run build` using `run_command` in `/Users/mac/mekong-cli/FnB-Container-Caffe` and verify that the build succeeds without error.
6. Run `npm run test` using `run_command` in `/Users/mac/mekong-cli/FnB-Container-Caffe` and verify that all test suites pass.
7. Write a detailed `handoff.md` report under `/Users/mac/mekong-cli/FnB-Container-Caffe/.agents/worker_100x_overhaul/handoff.md`. In this report, include:
   - A list of files edited and exact replacements made
   - Built and test commands executed along with output logs/results
   - A confirmation statement that there are no references to forbidden view types ('view đồng lúa', 'view sông trực tiếp')
   - A confirmation that Bazi elements (Mộc, Thủy, Kim) are respected and forbidden colors/fonts are clean.
8. Call `send_message` with Recipient `e3ed408f-b24f-4e3a-b46b-59901a1ed0ca` to notify me of task completion and share the path to `handoff.md`.
