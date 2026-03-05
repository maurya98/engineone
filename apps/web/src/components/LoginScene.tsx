import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function getThemeColors(): { bg: number; accent: number; fogFar: number } {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  if (isDark) {
    return {
      bg: 0x0d0f14,
      accent: 0x5b9cf9,
      fogFar: 18,
    };
  }
  return {
    bg: 0xf6f5f3,
    accent: 0x0d7ea8,
    fogFar: 18,
  };
}

/** Create a 2D gear profile (view from front); extrude to get 3D gear. */
function createGearGeometry(
  outerRadius: number,
  innerRadius: number,
  numTeeth: number,
  toothShare: number,
  depth: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const step = (2 * Math.PI) / numTeeth;
  const toothAngle = step * toothShare;

  for (let i = 0; i < numTeeth; i++) {
    const a0 = i * step;
    const a1 = a0 + toothAngle;
    const a2 = a0 + step;

    const x0o = outerRadius * Math.cos(a0);
    const y0o = outerRadius * Math.sin(a0);
    const x1o = outerRadius * Math.cos(a1);
    const y1o = outerRadius * Math.sin(a1);
    const x1i = innerRadius * Math.cos(a1);
    const y1i = innerRadius * Math.sin(a1);
    const x2i = innerRadius * Math.cos(a2);
    const y2i = innerRadius * Math.sin(a2);
    const x2o = outerRadius * Math.cos(a2);
    const y2o = outerRadius * Math.sin(a2);

    if (i === 0) {
      shape.moveTo(x0o, y0o);
    }
    shape.lineTo(x1o, y1o);
    shape.lineTo(x1i, y1i);
    shape.lineTo(x2i, y2i);
    shape.lineTo(x2o, y2o);
  }

  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth,
    bevelEnabled: false,
  };
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

export function LoginScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { bg, accent, fogFar } = getThemeColors();
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, 6, fogFar);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(bg);
    container.appendChild(renderer.domElement);

    const canvas = renderer.domElement;

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.4);
    keyLight.position.set(1, 1, 3);
    scene.add(keyLight);

    const accentColor = new THREE.Color(accent);
    const material = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.08,
      wireframe: true,
    });

    const gearGeometry = createGearGeometry(0.85, 0.5, 16, 0.4, 0.25);
    const gearSmall = createGearGeometry(0.5, 0.28, 12, 0.4, 0.18);

    const gear = new THREE.Mesh(gearGeometry, material);
    gear.position.set(0, 0, -2);
    gear.rotation.set(0.15, 0.5, 0);
    gear.scale.setScalar(1.85);
    scene.add(gear);

    const gear2 = new THREE.Mesh(gearSmall, material.clone());
    gear2.position.set(-2.35, 1.45, -3);
    gear2.rotation.set(0.1, 0.3, 0.4);
    gear2.scale.setScalar(1.4);
    scene.add(gear2);

    const gear3 = new THREE.Mesh(gearSmall, material.clone());
    gear3.position.set(2.25, -1.35, -2.6);
    gear3.rotation.set(-0.2, 0.6, 0.2);
    gear3.scale.setScalar(1.1);
    scene.add(gear3);

    const gear4 = new THREE.Mesh(gearSmall, material.clone());
    gear4.position.set(-2.2, -1.45, -3.2);
    gear4.rotation.set(0.25, 0.2, -0.15);
    gear4.scale.setScalar(0.9);
    scene.add(gear4);

    // Mouse state for hover interaction (normalized -1 to 1, center = 0)
    const mouse = { x: 0, y: 0, isHovering: false };
    const mouseTarget = { x: 0, y: 0 };
    const tiltAmount = 0.22;
    const spinSpeedIdle = 0.06;
    const spinSpeedHover = 0.22;

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseTarget.x = x * 2 - 1;
      mouseTarget.y = -(y * 2 - 1);
    }

    function onMouseEnter() {
      mouse.isHovering = true;
      canvas.style.cursor = 'pointer';
    }

    function onMouseLeave() {
      mouse.isHovering = false;
      mouseTarget.x = 0;
      mouseTarget.y = 0;
      canvas.style.cursor = 'default';
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseenter', onMouseEnter);
    canvas.addEventListener('mouseleave', onMouseLeave);

    let animationId: number;
    const clock = new THREE.Clock();

    function animate() {
      const t = clock.getElapsedTime();
      const dt = 0.016;

      mouse.x += (mouseTarget.x - mouse.x) * Math.min(1, dt * 8);
      mouse.y += (mouseTarget.y - mouse.y) * Math.min(1, dt * 8);

      const spinSpeed = mouse.isHovering ? spinSpeedHover : spinSpeedIdle;
      const tiltX = 0.15 + Math.sin(t * 0.08) * 0.03 + mouse.y * tiltAmount;
      const tiltY = 0.5 + mouse.x * tiltAmount;

      gear.rotation.z = t * spinSpeed;
      gear.rotation.x = tiltX;
      gear.rotation.y = tiltY;

      gear2.rotation.z = -t * spinSpeed * 0.9;
      gear2.rotation.x = tiltX * 0.8 + 0.1;
      gear2.rotation.y = tiltY * 0.8 + 0.3;

      gear3.rotation.z = t * spinSpeed * 1.1;
      gear3.rotation.x = tiltX * 0.7 - 0.2;
      gear3.rotation.y = tiltY * 0.7 + 0.6;

      gear4.rotation.z = -t * spinSpeed * 0.85;
      gear4.rotation.x = tiltX * 0.6 + 0.25;
      gear4.rotation.y = tiltY * 0.6 + 0.2;

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      if (!container.parentElement) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseenter', onMouseEnter);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animationId);
      gearGeometry.dispose();
      gearSmall.dispose();
      material.dispose();
      [gear2, gear3, gear4].forEach((g) => (g.material as THREE.Material).dispose());
      renderer.dispose();
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return <div ref={containerRef} className="login-scene" aria-hidden="true" />;
}
