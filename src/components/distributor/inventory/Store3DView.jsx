import React, { useRef, useState, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Environment, ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';

/**
 * World's First Advanced 3D Virtual Store
 * Features:
 * - Realistic 3D rendering with lighting and shadows
 * - Photo-based AR placement
 * - Multiple camera views (orbit, first-person, top-down)
 * - Interactive 3D models for all store elements
 */

// 3D Floor Component
const Floor3D = ({ floor, selected, onSelect }) => {
  const meshRef = useRef();
  
  useFrame(() => {
    if (meshRef.current && selected) {
      meshRef.current.rotation.y += 0.001; // Subtle animation when selected
    }
  });

  // Ensure minimum dimensions for clean rendering
  const floorWidth = Math.max(floor.width / 100, 5);
  const floorHeight = Math.max(floor.height / 100, 5);
  
  return (
    <group position={[floor.x / 100, 0, floor.y / 100]}>
      {/* Floor base - Clean and perfectly placed */}
      <mesh
        ref={meshRef}
        position={[0, -0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={onSelect}
        receiveShadow
      >
        <planeGeometry args={[floorWidth, floorHeight]} />
        <meshStandardMaterial
          color={selected ? '#10b981' : '#1f2937'}
          metalness={0.2}
          roughness={0.7}
          emissive={selected ? '#10b981' : '#000000'}
          emissiveIntensity={selected ? 0.3 : 0}
        />
      </mesh>
      
      {/* Floor border - Clean outline */}
      <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(floorWidth, floorHeight) / 2 - 0.1, Math.min(floorWidth, floorHeight) / 2, 64]} />
        <meshStandardMaterial 
          color={selected ? '#10b981' : '#4b5563'} 
          emissive={selected ? '#10b981' : '#000000'}
          emissiveIntensity={selected ? 0.2 : 0}
          transparent
          opacity={0.6}
        />
      </mesh>
      
      {/* Floor label - Clean and readable */}
      <Text
        position={[0, 0.2, 0]}
        fontSize={0.6}
        color={selected ? '#10b981' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
        font="/fonts/inter-bold.woff"
      >
        🏢 {floor.name}
      </Text>
      
      {/* Aisle count badge */}
      {floor.aisles && floor.aisles.length > 0 && (
        <Text
          position={[0, -0.1, 0]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {floor.aisles.length} aisle{floor.aisles.length !== 1 ? 's' : ''}
        </Text>
      )}
    </group>
  );
};

// 3D Aisle Component
const Aisle3D = ({ aisle, floor, selected, onSelect }) => {
  const meshRef = useRef();
  const color = new THREE.Color(aisle.color || '#a855f7');

  return (
    <group
      position={[
        (aisle.x - floor.x) / 100,
        0.5,
        (aisle.y - floor.y) / 100
      ]}
    >
      {/* Aisle structure */}
      <mesh
        ref={meshRef}
        position={[0, aisle.height / 200, 0]}
        castShadow
        receiveShadow
        onClick={onSelect}
      >
        <boxGeometry args={[aisle.width / 100, aisle.height / 100, 0.5]} />
        <meshStandardMaterial
          color={color}
          metalness={0.3}
          roughness={0.7}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Aisle label */}
      <Text
        position={[0, aisle.height / 200 + 0.3, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {aisle.name}
      </Text>
      
      {/* Category badge */}
      {aisle.category && (
        <mesh position={[aisle.width / 200, aisle.height / 200 + 0.2, 0.26]}>
          <boxGeometry args={[aisle.width / 150, 0.2, 0.05]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
      
      {/* Racks inside aisle */}
      {(aisle.racks || []).map((rack, idx) => (
        <Rack3D
          key={rack.id}
          rack={rack}
          aisle={aisle}
          floor={floor}
        />
      ))}
    </group>
  );
};

// 3D Rack Component
const Rack3D = ({ rack, aisle, floor }) => {
  return (
    <group
      position={[
        (rack.x - aisle.x) / 100,
        0.3,
        (rack.y - aisle.y) / 100
      ]}
    >
      {/* Rack structure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[rack.width / 100, rack.height / 100, 0.3]} />
        <meshStandardMaterial
          color="#4b5563"
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      
      {/* Shelves */}
      {(rack.shelves || []).map((shelf, idx) => (
        <Shelf3D
          key={shelf.id}
          shelf={shelf}
          rack={rack}
          aisle={aisle}
          floor={floor}
        />
      ))}
    </group>
  );
};

// 3D Shelf Component
const Shelf3D = ({ shelf, rack, aisle, floor }) => {
  return (
    <mesh
      position={[
        0,
        (shelf.y - rack.y) / 100,
        0
      ]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[shelf.width / 100, 0.05, 0.3]} />
      <meshStandardMaterial
        color="#6b7280"
        metalness={0.6}
        roughness={0.3}
      />
    </mesh>
  );
};

// Lighting setup
const Lighting = () => {
  return (
    <>
      {/* Ambient light for overall illumination */}
      <ambientLight intensity={0.6} />
      
      {/* Main directional light (sun) */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      
      {/* Fill light */}
      <directionalLight position={[-10, 5, -5]} intensity={0.3} />
      
      {/* Point lights for ambiance */}
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#ffffff" />
      <pointLight position={[5, 5, 5]} intensity={0.3} color="#a855f7" />
    </>
  );
};

// Main 3D Scene
const Scene3D = ({ floors, selectedFloor, onFloorSelect, selectedAisle, onAisleSelect }) => {
  return (
    <>
      <Lighting />
      <ContactShadows
        position={[0, -0.1, 0]}
        opacity={0.4}
        scale={20}
        blur={2}
        far={4.5}
      />
      
      {/* Render floors */}
      {floors.map(floor => (
        <Floor3D
          key={floor.id}
          floor={floor}
          selected={selectedFloor === floor.id}
          onSelect={() => onFloorSelect(floor.id)}
        />
      ))}
      
      {/* Render aisles */}
      {floors.map(floor =>
        (floor.aisles || []).map(aisle => (
          <Aisle3D
            key={aisle.id}
            aisle={aisle}
            floor={floor}
            selected={selectedAisle === aisle.id}
            onSelect={() => onAisleSelect(aisle.id)}
          />
        ))
      )}
    </>
  );
};


// Main 3D View Component
const Store3DView = ({
  floors = [],
  selectedFloor,
  onFloorSelect,
  selectedAisle,
  onAisleSelect,
  viewMode = 'orbit', // 'orbit', 'first-person', 'top-down'
}) => {
  const controlsRef = useRef();
  const [currentFloorIndex, setCurrentFloorIndex] = useState(0);
  
  // Filter floors to show only selected floor in 3D
  const floorsToRender = selectedFloor 
    ? floors.filter(f => f.id === selectedFloor)
    : floors;
  
  // Update currentFloorIndex when selectedFloor changes
  useEffect(() => {
    if (selectedFloor) {
      const index = floors.findIndex(f => f.id === selectedFloor);
      if (index !== -1) {
        setCurrentFloorIndex(index);
      }
    }
  }, [selectedFloor, floors]);

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [10, 10, 10], fov: 50 }}
      >
        <Suspense fallback={null}>
          {/* Camera based on view mode */}
          {viewMode === 'top-down' ? (
            <OrthographicCamera
              makeDefault
              position={[0, 20, 0]}
              zoom={50}
            />
          ) : viewMode === 'first-person' ? (
            <PerspectiveCamera
              makeDefault
              position={[0, 1.6, 5]}
              fov={75}
            />
          ) : (
            <PerspectiveCamera
              makeDefault
              position={[10, 10, 10]}
              fov={50}
            />
          )}

          {/* 3D Scene */}
          {floors.length > 0 && (
            <Scene3D
              floors={floorsToRender}
              selectedFloor={selectedFloor}
              onFloorSelect={onFloorSelect}
              selectedAisle={selectedAisle}
              onAisleSelect={onAisleSelect}
            />
          )}

          {/* Camera controls */}
          {viewMode !== 'first-person' && (
            <OrbitControls
              ref={controlsRef}
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={5}
              maxDistance={50}
              minPolarAngle={viewMode === 'top-down' ? Math.PI / 2 : 0}
              maxPolarAngle={viewMode === 'top-down' ? Math.PI / 2 : Math.PI / 2}
            />
          )}

          {/* Environment for realistic reflections */}
          <Environment preset="city" />
        </Suspense>
      </Canvas>
      
      {/* View mode indicator */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-sm">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">●</span>
          <span>3D View: {viewMode}</span>
        </div>
      </div>
      
      {/* Floor Navigation for 3D View */}
      {floors.length > 1 && viewMode === '3d' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-white/20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newIndex = currentFloorIndex > 0 ? currentFloorIndex - 1 : floors.length - 1;
                setCurrentFloorIndex(newIndex);
                onFloorSelect(floors[newIndex].id);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
            >
              ← Prev
            </button>
            <div className="text-sm font-medium">
              Floor {currentFloorIndex + 1} of {floors.length}
            </div>
            <button
              onClick={() => {
                const newIndex = currentFloorIndex < floors.length - 1 ? currentFloorIndex + 1 : 0;
                setCurrentFloorIndex(newIndex);
                onFloorSelect(floors[newIndex].id);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
            >
              Next →
            </button>
          </div>
          <div className="mt-2 flex gap-1 justify-center">
            {floors.map((floor, idx) => (
              <button
                key={floor.id}
                onClick={() => {
                  setCurrentFloorIndex(idx);
                  onFloorSelect(floor.id);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentFloorIndex ? 'bg-emerald-400 w-6' : 'bg-white/30 hover:bg-white/50'
                }`}
                title={floor.name}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Mobile/Tablet Controls */}
      <div className="absolute bottom-4 right-4 md:hidden">
        <div className="bg-black/80 backdrop-blur-sm p-2 rounded-lg space-y-2">
          <button
            onClick={() => {
              // Zoom in
              if (controlsRef.current) {
                controlsRef.current.dollyOut(0.5);
              }
            }}
            className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg"
          >
            +
          </button>
          <button
            onClick={() => {
              // Zoom out
              if (controlsRef.current) {
                controlsRef.current.dollyIn(0.5);
              }
            }}
            className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
};

export default Store3DView;

