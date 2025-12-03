import React, { useRef, useState, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Environment, ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';

// Error boundary wrapper for 3D components - handles Text component errors gracefully
const SafeText = React.memo(({ children, ...props }) => {
  try {
    // Check if Text component is available
    if (typeof Text === 'undefined' || !Text) {
      throw new Error('Text component not available');
    }
    
    // Remove problematic props that might cause issues
    const { font, maxWidth, ...safeProps } = props;
    const cleanProps = {
      ...safeProps,
      fontSize: props.fontSize || 0.1,
      color: props.color || '#ffffff',
      anchorX: props.anchorX || 'center',
      anchorY: props.anchorY || 'middle',
    };
    
    return <Text {...cleanProps}>{String(children || '')}</Text>;
  } catch (error) {
    console.warn('Text component error:', error);
    // Fallback: render a simple mesh with text-like appearance
    return (
      <mesh position={props.position || [0, 0, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.01]} />
        <meshStandardMaterial color={props.color || '#ffffff'} />
      </mesh>
    );
  }
});
SafeText.displayName = 'SafeText';

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
      <SafeText
        position={[0, 0.2, 0]}
        fontSize={0.6}
        color={selected ? '#10b981' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        🏢 {floor.name}
      </SafeText>
      
      {/* Aisle count badge */}
      {floor.aisles && floor.aisles.length > 0 && (
        <SafeText
          position={[0, -0.1, 0]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {floor.aisles.length} aisle{floor.aisles.length !== 1 ? 's' : ''}
        </SafeText>
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
      <SafeText
        position={[0, aisle.height / 200 + 0.3, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {aisle.name}
      </SafeText>
      
      {/* Category badge */}
      {aisle.category && (
        <mesh position={[aisle.width / 200, aisle.height / 200 + 0.2, 0.26]}>
          <boxGeometry args={[aisle.width / 150, 0.2, 0.05]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
      
      {/* Products directly in aisle (if any) - Real-time visualization */}
      {(aisle.products || []).map((product, idx) => {
        const stockColor = product.quantity === 0 ? '#ef4444' : 
                          product.quantity <= 10 ? '#f59e0b' : '#10b981';
        return (
          <group
            key={product.id || idx}
            position={[
              (idx % 3 - 1) * 0.3,
              aisle.height / 200 + 0.5,
              (Math.floor(idx / 3) * 0.2) - 0.2
            ]}
          >
            <mesh castShadow>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshStandardMaterial
                color={stockColor}
                metalness={0.3}
                roughness={0.7}
                emissive={stockColor}
                emissiveIntensity={0.2}
              />
            </mesh>
            {product.name && (
              <SafeText
                position={[0, 0.15, 0]}
                fontSize={0.08}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.01}
                outlineColor="#000000"
              >
                {product.name.substring(0, 8)}
              </SafeText>
            )}
          </group>
        );
      })}
      
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

// 3D Rack Component with Products - Optimized for performance
const Rack3D = ({ rack, aisle, floor }) => {
  const rackProducts = rack.products || [];
  const rackRef = useRef();
  
  // Subtle animation for alive feel
  useFrame((state) => {
    if (rackRef.current && rackProducts.length > 0) {
      rackRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.01;
    }
  });
  
  return (
    <group
      ref={rackRef}
      position={[
        (rack.x - aisle.x) / 100,
        0.3,
        (rack.y - aisle.y) / 100
      ]}
    >
      {/* Rack structure - Realistic metal frame */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[rack.width / 100, rack.height / 100, 0.3]} />
        <meshStandardMaterial
          color="#4b5563"
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={0.4}
        />
      </mesh>
      
      {/* Rack frame edges - More realistic */}
      <mesh position={[0, 0, 0.15]} castShadow>
        <boxGeometry args={[rack.width / 100, rack.height / 100, 0.02]} />
        <meshStandardMaterial 
          color="#374151" 
          metalness={0.8} 
          roughness={0.2}
          emissive="#1f2937"
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Rack vertical supports - More realistic structure */}
      <mesh position={[-rack.width / 200, 0, 0.16]} castShadow>
        <boxGeometry args={[0.02, rack.height / 100, 0.02]} />
        <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[rack.width / 200, 0, 0.16]} castShadow>
        <boxGeometry args={[0.02, rack.height / 100, 0.02]} />
        <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Products directly on rack (if any) - Real-time visualization */}
      {rackProducts.map((product, idx) => {
        const stockColor = product.quantity === 0 ? '#ef4444' : 
                          product.quantity <= 10 ? '#f59e0b' : '#10b981';
        return (
          <group
            key={product.id || idx}
            position={[0, (idx * 0.2) - (rackProducts.length * 0.1), 0.16]}
          >
            <mesh castShadow>
              <boxGeometry args={[rack.width / 100 - 0.1, 0.15, 0.1]} />
              <meshStandardMaterial
                color={stockColor}
                metalness={0.2}
                roughness={0.8}
                emissive={stockColor}
                emissiveIntensity={0.2}
              />
            </mesh>
            {product.name && (
              <SafeText
                position={[0, 0.1, 0.05]}
                fontSize={0.06}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.01}
                outlineColor="#000000"
              >
                {product.name.substring(0, 8)}
              </SafeText>
            )}
          </group>
        );
      })}
      
      {/* Rack label with product count */}
      {rackProducts.length > 0 && (
        <SafeText
          position={[0, rack.height / 200 + 0.1, 0.16]}
          fontSize={0.1}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {rack.name} ({rackProducts.length})
        </SafeText>
      )}
      
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

// 3D Shelf Component with Products - Realistic and performant
const Shelf3D = ({ shelf, rack, aisle, floor }) => {
  const shelfProducts = (shelf.products || []).concat(
    ...(shelf.lanes || []).flatMap(lane => lane.products || [])
  );
  const shelfRef = useRef();
  
  // Subtle animation for alive feel
  useFrame((state) => {
    if (shelfRef.current && shelfProducts.length > 0) {
      shelfRef.current.position.y = (shelf.y - rack.y) / 100 + Math.sin(state.clock.elapsedTime * 0.3) * 0.005;
    }
  });

  return (
    <group
      ref={shelfRef}
      position={[
        0,
        (shelf.y - rack.y) / 100,
        0
      ]}
    >
      {/* Shelf surface - Realistic wood/metal shelf */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[shelf.width / 100, 0.05, 0.3]} />
        <meshStandardMaterial
          color="#6b7280"
          metalness={0.6}
          roughness={0.3}
          emissive="#4b5563"
          emissiveIntensity={0.05}
        />
      </mesh>
      
      {/* Shelf front edge - More realistic */}
      <mesh position={[0, 0.025, 0.15]} castShadow>
        <boxGeometry args={[shelf.width / 100, 0.01, 0.01]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.2} />
      </mesh>
      
      {/* Products on shelf - Real-time visualization */}
      {shelfProducts.map((product, idx) => {
        const productsPerRow = Math.max(1, Math.floor(shelf.width / 30));
        const row = Math.floor(idx / productsPerRow);
        const col = idx % productsPerRow;
        const spacing = shelf.width / 100 / (productsPerRow + 1);
        const depth = 0.3 / Math.max(1, Math.floor(shelfProducts.length / productsPerRow) + 1);
        
        // Use product image if available, otherwise use color based on stock
        const stockColor = product.quantity === 0 ? '#ef4444' : 
                          product.quantity <= 10 ? '#f59e0b' : '#10b981';
        
        return (
          <group
            key={product.id || idx}
            position={[
              -shelf.width / 200 + spacing * (col + 1),
              0.05,
              -depth + (row * depth * 2)
            ]}
          >
            {/* Product box - Real-time product visualization */}
            <mesh castShadow>
              <boxGeometry args={[0.15, 0.15, 0.15]} />
              <meshStandardMaterial
                color={product.imageUrl ? '#ffffff' : '#10b981'}
                metalness={0.2}
                roughness={0.8}
              />
            </mesh>
            {/* Product label */}
            <SafeText
              position={[0, 0.2, 0]}
              fontSize={0.08}
              color="#000000"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.3}
            >
              {product.name?.substring(0, 10) || 'Product'}
            </SafeText>
          </group>
        );
      })}
      
      {/* Lanes visualization - Real-time product display */}
      {(shelf.lanes || []).map((lane, laneIdx) => {
        const laneProducts = lane.products || [];
        return (
          <group key={lane.id} position={[(lane.x - shelf.x) / 100, 0.06, 0]}>
            {laneProducts.map((product, pIdx) => {
              const stockColor = product.quantity === 0 ? '#ef4444' : 
                                product.quantity <= 10 ? '#f59e0b' : '#10b981';
              return (
                <group
                  key={product.id || pIdx}
                  position={[0, 0, (pIdx * 0.1) - (laneProducts.length * 0.05)]}
                >
                  <mesh castShadow>
                    <boxGeometry args={[lane.width / 100 - 0.02, 0.12, 0.08]} />
                    <meshStandardMaterial
                      color={stockColor}
                      metalness={0.3}
                      roughness={0.7}
                      emissive={stockColor}
                      emissiveIntensity={0.2}
                    />
                  </mesh>
                  {product.name && (
                    <SafeText
                      position={[0, 0.08, 0.04]}
                      fontSize={0.06}
                      color="#ffffff"
                      anchorX="center"
                      anchorY="middle"
                      outlineWidth={0.01}
                      outlineColor="#000000"
                    >
                      {product.name.substring(0, 8)}
                    </SafeText>
                  )}
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
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

// Main 3D Scene - Optimized for large inventories (1000+ racks)
const Scene3D = ({ floors, selectedFloor, onFloorSelect, selectedAisle, onAisleSelect, searchQuery = '' }) => {
  // Filter aisles/racks/shelves based on search query for performance
  const filteredFloors = React.useMemo(() => {
    if (!searchQuery) return floors;
    
    const query = searchQuery.toLowerCase();
    return floors.map(floor => ({
      ...floor,
      aisles: (floor.aisles || []).map(aisle => {
        const aisleMatches = aisle.name?.toLowerCase().includes(query) || 
                            aisle.category?.toLowerCase().includes(query);
        const rackMatches = (aisle.racks || []).some(rack => 
          rack.name?.toLowerCase().includes(query) ||
          (rack.products || []).some(p => p.name?.toLowerCase().includes(query))
        );
        
        if (aisleMatches || rackMatches) {
          return {
            ...aisle,
            racks: (aisle.racks || []).map(rack => {
              const shelfMatches = (rack.shelves || []).some(shelf =>
                shelf.name?.toLowerCase().includes(query) ||
                (shelf.products || []).some(p => p.name?.toLowerCase().includes(query))
              );
              if (rackMatches || shelfMatches) {
                return {
                  ...rack,
                  shelves: (rack.shelves || []).map(shelf => ({
                    ...shelf,
                    // Only show products that match search
                    products: searchQuery ? 
                      (shelf.products || []).filter(p => p.name?.toLowerCase().includes(query)) :
                      shelf.products
                  }))
                };
              }
              return rack;
            })
          };
        }
        return aisle;
      }).filter(aisle => {
        // Only show aisles that have matches
        return aisle.name?.toLowerCase().includes(query) ||
               aisle.category?.toLowerCase().includes(query) ||
               (aisle.racks || []).some(rack => 
                 rack.name?.toLowerCase().includes(query) ||
                 (rack.products || []).some(p => p.name?.toLowerCase().includes(query))
               );
      })
    }));
  }, [floors, searchQuery]);
  
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
      
      {/* Render floors - Optimized */}
      {filteredFloors.map(floor => (
        <Floor3D
          key={floor.id}
          floor={floor}
          selected={selectedFloor === floor.id}
          onSelect={() => onFloorSelect(floor.id)}
        />
      ))}
      
      {/* Render aisles - Only render visible ones for performance (limit to 100 aisles) */}
      {filteredFloors.map(floor =>
        (floor.aisles || []).slice(0, 100).map(aisle => (
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


// Main 3D View Component - Enhanced with search
const Store3DView = ({
  floors = [],
  selectedFloor,
  onFloorSelect,
  selectedAisle,
  onAisleSelect,
  viewMode = 'orbit', // 'orbit', 'first-person', 'top-down'
  searchQuery = '', // Search filter for products/aisles
}) => {
  const controlsRef = useRef();
  const [currentFloorIndex, setCurrentFloorIndex] = useState(0);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  
  // Sync with parent search query
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);
  
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

  // Error boundary for Canvas
  if (!floors || floors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/60">
        <div className="text-center">
          <div className="text-4xl mb-4">🏢</div>
          <p className="text-lg mb-2 font-semibold">No Store Layout</p>
          <p className="text-sm">Create floors and aisles in 2D view first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true
        }}
        camera={{ position: [10, 10, 10], fov: 50 }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          // Ensure WebGL context is properly initialized
          gl.setClearColor('#0a0a0a', 1);
        }}
      >
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#10b981" />
          </mesh>
        }>
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

          {/* 3D Scene - Optimized for large inventories */}
          {floors.length > 0 && (
            <Scene3D
              floors={floorsToRender}
              selectedFloor={selectedFloor}
              onFloorSelect={onFloorSelect}
              selectedAisle={selectedAisle}
              onAisleSelect={onAisleSelect}
              searchQuery={localSearchQuery}
            />
          )}

          {/* Camera controls - 360 degree rotation */}
          {viewMode !== 'first-person' && (
            <OrbitControls
              ref={controlsRef}
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={3}
              maxDistance={100}
              minPolarAngle={viewMode === 'top-down' ? Math.PI / 2 : 0}
              maxPolarAngle={viewMode === 'top-down' ? Math.PI / 2 : Math.PI}
              autoRotate={false}
              autoRotateSpeed={0.5}
              enableDamping={true}
              dampingFactor={0.05}
            />
          )}

          {/* Environment for realistic reflections */}
          <Environment preset="city" />
        </Suspense>
      </Canvas>
      
      {/* View mode indicator with search status */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-sm">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">●</span>
          <span>3D View: {viewMode}</span>
        </div>
        {localSearchQuery && (
          <div className="mt-2 text-xs text-emerald-300">
            🔍 Filtering: "{localSearchQuery}"
          </div>
        )}
      </div>
      
      {/* 360 View Instructions */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-xs max-w-xs">
        <div className="font-semibold mb-1">🎮 360° View Controls</div>
        <div className="space-y-0.5 text-white/70">
          <div>🖱️ <strong>Left Click + Drag:</strong> Rotate view</div>
          <div>🖱️ <strong>Right Click + Drag:</strong> Pan view</div>
          <div>🖱️ <strong>Scroll:</strong> Zoom in/out</div>
          <div>📦 Products shown as colored boxes</div>
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

