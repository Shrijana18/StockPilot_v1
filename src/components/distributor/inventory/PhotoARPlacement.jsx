import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Photo-Based AR Placement System
 * Allows users to place 3D store elements on uploaded photos with perspective correction
 */

const PhotoARPlacement = ({ 
  imageUrl, 
  onPlaceElement, 
  placementMode, // 'aisle', 'rack', 'shelf'
  floors,
  selectedFloor,
}) => {
  const { camera, raycaster } = useThree();
  const [isPlacing, setIsPlacing] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(null);
  const planeRef = useRef();
  const mouseRef = useRef(new THREE.Vector2());

  // Handle click to place element
  const handleClick = (event) => {
    if (!placementMode || !selectedFloor) return;
    event.stopPropagation();
    
    const point = event.point;
    onPlaceElement({
      type: placementMode,
      position: { x: point.x * 100, y: point.z * 100 },
      floorId: selectedFloor,
    });
  };

  // Track pointer for preview
  const handlePointerMove = (event) => {
    if (!placementMode) return;
    setPreviewPosition(event.point);
    setIsPlacing(true);
  };

  const handlePointerLeave = () => {
    setIsPlacing(false);
  };

  return (
    <>
      {/* Photo background plane */}
      <mesh
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <planeGeometry args={[20, 15]} />
        <meshBasicMaterial>
          <primitive object={new THREE.TextureLoader().load(imageUrl)} attach="map" />
        </meshBasicMaterial>
      </mesh>

      {/* Preview element at mouse position */}
      {isPlacing && previewPosition && placementMode && (
        <PreviewElement
          type={placementMode}
          position={previewPosition}
        />
      )}

      {/* Grid overlay for alignment */}
      <GridOverlay />
    </>
  );
};

// Preview element that follows mouse
const PreviewElement = ({ type, position }) => {
  const getPreviewGeometry = () => {
    switch (type) {
      case 'aisle':
        return <boxGeometry args={[2, 3, 0.5]} />;
      case 'rack':
        return <boxGeometry args={[0.5, 2, 0.3]} />;
      case 'shelf':
        return <boxGeometry args={[0.5, 0.05, 0.3]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  return (
    <mesh position={[position.x, position.y + 0.1, position.z]}>
      {getPreviewGeometry()}
      <meshStandardMaterial
        color="#10b981"
        transparent
        opacity={0.6}
        emissive="#10b981"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
};

// Grid overlay for alignment
const GridOverlay = () => {
  return (
    <gridHelper
      args={[20, 20, '#ffffff', '#666666']}
      position={[0, 0.01, 0]}
    />
  );
};

export default PhotoARPlacement;

