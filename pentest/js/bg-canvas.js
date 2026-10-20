/**
 * 🌌 DewSecure 高性能背景矩阵流 (完整穿越 + 渐变光带 + 不占线)
 * 红线沿网格线行走，头部和尾部渐隐，中间最亮，长度缩短，且避免两条线同时使用同一条网格线
 */
(function() {
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:-1; pointer-events:none;';
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let w, h, dpr;

    function resize() {
        dpr = window.devicePixelRatio || 1;
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);
    }
    
    window.addEventListener('resize', () => {
        resize();
        [lineA, lineB, lineC].forEach(l => l.reset());
    });
    resize();

    const STEP = 110;
    const DURATION = 2800;       // 线头穿越时间
    const OFFSET = 200;

    // 网格占用记录：记录当前活跃线条占据的网格线坐标
    // 水平线(0/1)记录 y 坐标，垂直线(2/3)记录 x 坐标
    const occupiedLines = {
        horizontal: new Set(),  // 存放 y 值
        vertical: new Set()     // 存放 x 值
    };

    class FlowLine {
        constructor() {
            this.reset();
        }

        reset() {
            // 释放之前占用的网格线
            if (this.active && (this.direction === 0 || this.direction === 1)) {
                occupiedLines.horizontal.delete(this.gridPos);
            } else if (this.active) {
                occupiedLines.vertical.delete(this.gridPos);
            }
            this.active = false;
            this.fading = false;
            this.tail = [];
            this.tailLen = 60;       // 缩短尾巴长度
            this.startTime = 0;
            this.gridPos = null;     // 存储占据的网格坐标
        }

        start(dir, pos, snapW, snapH) {
            this.direction = dir;
            const W = snapW;
            const H = snapH;
            this.gridPos = pos;      // 记录占据的网格坐标
            // 标记占用
            if (dir === 0 || dir === 1) {
                occupiedLines.horizontal.add(pos);
            } else {
                occupiedLines.vertical.add(pos);
            }

            switch (dir) {
                case 0:
                    this.startX = -OFFSET; this.startY = pos;
                    this.endX = W + OFFSET; this.endY = pos;
                    break;
                case 1:
                    this.startX = W + OFFSET; this.startY = pos;
                    this.endX = -OFFSET; this.endY = pos;
                    break;
                case 2:
                    this.startX = pos; this.startY = -OFFSET;
                    this.endX = pos; this.endY = H + OFFSET;
                    break;
                case 3:
                    this.startX = pos; this.startY = H + OFFSET;
                    this.endX = pos; this.endY = -OFFSET;
                    break;
            }
            this.x = this.startX;
            this.y = this.startY;
            this.startTime = performance.now();
            this.tail = [{ x: this.x, y: this.y }];
            this.active = true;
            this.fading = false;
        }

        update() {
            if (!this.active) return;

            if (this.fading) {
                if (this.tail.length > 0) {
                    this.tail.shift();
                } else {
                    this.reset();   // 完全消失，释放网格线
                }
                return;
            }

            const progress = Math.min((performance.now() - this.startTime) / DURATION, 1);
            this.x = this.startX + (this.endX - this.startX) * progress;
            this.y = this.startY + (this.endY - this.startY) * progress;

            this.tail.push({ x: this.x, y: this.y });
            if (this.tail.length > this.tailLen) this.tail.shift();

            if (progress >= 1) {
                this.fading = true;
            }
        }

        draw(ctx) {
            if (!this.active || this.tail.length < 2) return;

            // 逐段绘制，根据位置计算透明度（两端透明，中间最亮）
            const len = this.tail.length;
            for (let i = 1; i < len; i++) {
                const pos = i / (len - 1);
                const alpha = Math.sin(pos * Math.PI) * 0.35;
                
                ctx.beginPath();
                ctx.moveTo(this.tail[i - 1].x, this.tail[i - 1].y);
                ctx.lineTo(this.tail[i].x, this.tail[i].y);
                ctx.strokeStyle = `rgba(255, 80, 80, ${alpha.toFixed(2)})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }

    const [lineA, lineB, lineC] = [new FlowLine(), new FlowLine(), new FlowLine()];

    // 获取可用的网格线位置（未被占用的）
    function getAvailableGridLine(isHorizontal) {
        let candidates = [];
        const max = isHorizontal ? h : w;
        const count = Math.floor(max / STEP) + 1;
        for (let i = 0; i < count; i++) {
            const coord = i * STEP;
            if (coord > max) break;
            if (isHorizontal && !occupiedLines.horizontal.has(coord)) {
                candidates.push(coord);
            } else if (!isHorizontal && !occupiedLines.vertical.has(coord)) {
                candidates.push(coord);
            }
        }
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function animate() {
        ctx.clearRect(0, 0, w, h);
        
        // 绘制网格
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.06)';
        ctx.lineWidth = 0.8;
        for (let x = 0; x <= w; x += STEP) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y <= h; y += STEP) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // 管理红线
        [lineA, lineB, lineC].forEach(line => {
            if (!line.active) {
                if (Math.random() > 0.992) {
                    const dir = Math.floor(Math.random() * 4);
                    const isHorizontal = (dir === 0 || dir === 1);
                    const availablePos = getAvailableGridLine(isHorizontal);
                    if (availablePos !== null) {
                        line.start(dir, availablePos, w, h);
                    }
                    // 如果无可用网格线，则放弃本次生成，等待下次机会
                }
            } else {
                line.update();
                line.draw(ctx);
            }
        });

        requestAnimationFrame(animate);
    }
    animate();
})();
