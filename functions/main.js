window.Route = (t) => {
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(e => e.classList.remove('active'));
    
    const btn = document.querySelector(`.nav-item[onclick="Route('${t}')"]`); 
    if(btn) btn.classList.add('active');
    
    const tab = document.getElementById('tab-'+t); 
    if(tab) tab.classList.add('active');
    
    const sidebar = document.getElementById('sidebar'); 
    const overlay = document.getElementById('sidebar-overlay'); 
    if(sidebar) sidebar.classList.remove('open'); 
    if(overlay) overlay.classList.remove('open');
    
    if(t === 'dms') Chat.loadDMs();
    if(t === 'settings') { if(window.Settings && Settings.renderMainMenu) Settings.renderMainMenu(); }
    
    if(t === 'voice' && window.Voice) Voice.load();
};

const Background = {
    scene: null, stars: null, mesh: null, renderer: null,
    init: () => {
        const container = document.getElementById('bg-canvas'); if(!container) return;
        const scene = new THREE.Scene(); Background.scene = scene;
        const bgCol = 0x05000a; const accentCol = 0xd600ff;
        scene.fog = new THREE.FogExp2(bgCol, 0.002);
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000); camera.position.z = 5;
        const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true}); Background.renderer = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight); container.appendChild(renderer.domElement);
        const bgGeo = new THREE.BufferGeometry(); const pos = new Float32Array(3000*3);
        for(let i=0; i<3000*3; i++) pos[i] = (Math.random()-0.5)*40;
        bgGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        Background.stars = new THREE.Points(bgGeo, new THREE.PointsMaterial({size:0.02, color: accentCol})); scene.add(Background.stars);
        const geo = new THREE.IcosahedronGeometry(1.2, 1); const mat = new THREE.MeshBasicMaterial({color: accentCol, wireframe: true, transparent:true, opacity:0.15});
        Background.mesh = new THREE.Mesh(geo, mat); scene.add(Background.mesh);
        const anim = () => { requestAnimationFrame(anim); Background.stars.rotation.y += 0.0005; Background.mesh.rotation.y -= 0.002; Background.mesh.rotation.x += 0.001; renderer.render(scene, camera); }; anim();
        window.onresize = () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    },
    updateColor: (bgHex, accentHex) => {
        if(!Background.scene) return; const bg = new THREE.Color(bgHex); const acc = new THREE.Color(accentHex);
        Background.scene.fog.color = bg; Background.stars.material.color = acc; Background.mesh.material.color = acc;
    }
};
const Notifications = { init: () => { if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission(); } };
document.addEventListener('DOMContentLoaded', () => { Background.init(); Notifications.init(); if(Auth && Auth.init) Auth.init(); });