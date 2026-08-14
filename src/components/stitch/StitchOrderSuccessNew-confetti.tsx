/**
 * StitchOrderSuccessNew-confetti — WebGL shader background
 *
 * Full-viewport canvas rendering a dark nebula with bronze glimmer,
 * matching the original Stitch HTML ANIMATION_63 effect.
 */

'use client';

import { useEffect, useRef } from 'react';

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cvs = canvas;
    function syncSize() {
      const w = cvs.clientWidth || 1280;
      const h = cvs.clientHeight || 720;
      if (cvs.width !== w || cvs.height !== h) {
        cvs.width = w;
        cvs.height = h;
      }
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncSize);
      ro.observe(cvs);
    }
    syncSize();

    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;
    const g = gl;

    const vs =
      'attribute vec2 a_position;' +
      'varying vec2 v_texCoord;' +
      'void main() {' +
      '  v_texCoord = a_position * 0.5 + 0.5;' +
      '  gl_Position = vec4(a_position, 0.0, 1.0);' +
      '}';
    const fs =
      'precision highp float;' +
      'uniform float u_time;' +
      'uniform vec2 u_resolution;' +
      'void main() {' +
      '    vec2 uv = gl_FragCoord.xy / u_resolution.xy;' +
      '    float noise = sin(uv.x * 3.0 + u_time * 0.2) * cos(uv.y * 2.0 - u_time * 0.15);' +
      '    vec3 color1 = vec3(0.02, 0.06, 0.1);' +
      '    vec3 color2 = vec3(0.01, 0.03, 0.05);' +
      '    vec3 finalColor = mix(color1, color2, noise * 0.5 + 0.5);' +
      '    float glimmer = pow(max(0.0, sin(uv.x * 10.0 + uv.y * 10.0 + u_time * 0.5)), 50.0);' +
      '    finalColor += vec3(0.8, 0.5, 0.3) * glimmer * 0.05;' +
      '    gl_FragColor = vec4(finalColor, 1.0);' +
      '}';

    function createShader(type: number, src: string) {
      const s = g.createShader(type)!;
      g.shaderSource(s, src);
      g.compileShader(s);
      return s;
    }

    const prog = g.createProgram()!;
    g.attachShader(prog, createShader(gl.VERTEX_SHADER, vs));
    g.attachShader(prog, createShader(gl.FRAGMENT_SHADER, fs));
    g.linkProgram(prog);
    g.useProgram(prog);

    const buf = gl.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(
      g.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      g.STATIC_DRAW,
    );

    const pos = g.getAttribLocation(prog, 'a_position');
    g.enableVertexAttribArray(pos);
    g.vertexAttribPointer(pos, 2, g.FLOAT, false, 0, 0);

    const uTime = g.getUniformLocation(prog, 'u_time');
    const uRes = g.getUniformLocation(prog, 'u_resolution');
    const uMouse = g.getUniformLocation(prog, 'u_mouse');

    const cvs2 = canvas;
    const mouse = { x: cvs2.width / 2, y: cvs2.height / 2 };

    function onMouseMove(event: MouseEvent) {
      const rect = cvs2.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        mouse.x = nx * cvs2.width;
        mouse.y = ny * cvs2.height;
      }
    }
    window.addEventListener('mousemove', onMouseMove);

    let animId = 0;
    function render(t: number) {
      if (!ro) syncSize();
      const g2 = gl as WebGLRenderingContext;
      const cvs3 = canvas as HTMLCanvasElement;
      g2.viewport(0, 0, cvs3.width, cvs3.height);
      if (uTime) g2.uniform1f(uTime, t * 0.001);
      if (uRes) g2.uniform2f(uRes, cvs3.width, cvs3.height);
      if (uMouse) g2.uniform2f(uMouse, mouse.x, mouse.y);
      g2.drawArrays(g2.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    }
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      if (ro) ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10 opacity-60"
      style={{ display: 'block', width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  );
}
