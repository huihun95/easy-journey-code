'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, Eye, Code, Trash2, Move, Settings, Play, 
  GitBranch, FileText, Zap, Target, Users, 
  ChevronDown, ChevronRight, Search, Filter,
  Copy, Download, Upload, RefreshCw
} from 'lucide-react';

interface Node {
  id: string;
  name: string;
  codetype: 'view' | 'component' | 'function';
  x: number;
  y: number;
  connections: string[];
  expanded: boolean;
  description?: string;
  complexity?: 'low' | 'medium' | 'high';
  parentId?: string; // 드롭될 수 있는 부모 노드
  childrenIds?: string[]; // 내부에 포함된 자식 노드들
  isDropTarget?: boolean; // 드롭 타겟 상태
  isDraggedOver?: boolean; // 드래그 오버 상태
}

interface Analytics {
  totalNodes: number;
  viewNodes: number;
  componentNodes: number;
  functionNodes: number;
  complexityCount: {
    low: number;
    medium: number;
    high: number;
  };
  maxDepth: number;
  avgConnections: string;
}

const EnhancedFlutterDesigner: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([
    { id: 'app', name: '내 앱', codetype: 'view', x: 400, y: 100, connections: ['main'], expanded: true, description: '메인 애플리케이션 루트', childrenIds: [] },
    { id: 'main', name: '메인페이지', codetype: 'view', x: 400, y: 250, connections: ['header-comp', 'content-comp', 'footer-comp', 'auth-func'], expanded: true, description: '애플리케이션의 메인 화면', childrenIds: [] },
    
    // 컴포넌트 계층
    { id: 'header-comp', name: '헤더 컴포넌트', codetype: 'component', x: 200, y: 400, connections: ['login-func', 'search-func'], expanded: false, description: '상단 네비게이션 UI 컴포넌트', childrenIds: [] },
    { id: 'content-comp', name: '컨텐츠 컴포넌트', codetype: 'component', x: 400, y: 400, connections: ['contents-func'], expanded: false, description: '메인 컨텐츠 UI 컴포넌트', childrenIds: [] },
    { id: 'footer-comp', name: '푸터 컴포넌트', codetype: 'component', x: 600, y: 400, connections: ['sitemap-func'], expanded: false, description: '하단 정보 UI 컴포넌트', childrenIds: [] },
    { id: 'calendar-comp', name: '달력 컴포넌트', codetype: 'component', x: 500, y: 400, connections: ['calendar-func'], expanded: false, description: '달력 UI 컴포넌트', childrenIds: [] },
    
    // 기능 계층
    { id: 'login-func', name: '로그인 기능', codetype: 'function', x: 100, y: 550, connections: [], expanded: false, description: '사용자 인증 로직', complexity: 'medium' },
    { id: 'search-func', name: '검색 기능', codetype: 'function', x: 300, y: 550, connections: [], expanded: false, description: '통합 검색 기능', complexity: 'high' },
    { id: 'contents-func', name: '컨텐츠 기능', codetype: 'function', x: 350, y: 550, connections: [], expanded: false, description: '컨텐츠 관리 로직', complexity: 'low' },
    { id: 'calendar-func', name: '달력 기능', codetype: 'function', x: 450, y: 550, connections: [], expanded: false, description: '일정 관리 기능', complexity: 'medium' },
    { id: 'sitemap-func', name: '사이트맵 기능', codetype: 'function', x: 600, y: 550, connections: [], expanded: false, description: '사이트 구조 네비게이션', complexity: 'low' },
    { id: 'auth-func', name: '인증 기능', codetype: 'function', x: 450, y: 300, connections: [], expanded: false, description: '페이지 레벨 인증 처리', complexity: 'high' }
  ]);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // 드래그 오프셋 추가
  const [dropTarget, setDropTarget] = useState<string | null>(null); // 드롭 타겟
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'design' | 'code' | 'analytics'>('design');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'view' | 'component' | 'function'>('all');
  
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<'view' | 'component' | 'function'>('view');
  const [newNodeDescription, setNewNodeDescription] = useState('');
  const [newNodeComplexity, setNewNodeComplexity] = useState<'low' | 'medium' | 'high'>('low');
  
  const canvasRef = useRef<SVGSVGElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // 노드 필터링 및 검색
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          node.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterType === 'all' || node.codetype === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [nodes, searchQuery, filterType]);

  // 드롭 가능 여부 확인 (스크래치 스타일)
  const canDropInside = useCallback((draggedNodeId: string, targetNodeId: string) => {
    const draggedNode = nodes.find(n => n.id === draggedNodeId);
    const targetNode = nodes.find(n => n.id === targetNodeId);
    
    if (!draggedNode || !targetNode) return false;
    
    // View: Component와 Function을 받을 수 있음
    if (targetNode.codetype === 'view') {
      return draggedNode.codetype === 'component' || draggedNode.codetype === 'function';
    }
    
    // Component: Function만 받을 수 있음
    if (targetNode.codetype === 'component') {
      return draggedNode.codetype === 'function';
    }
    
    // Function: 아무것도 받을 수 없음
    return false;
  }, [nodes]);

  // 복잡도별 색상 정의
  const getComplexityColor = (complexity?: string) => {
    switch (complexity) {
      case 'low': return 'border-green-300 bg-green-50';
      case 'medium': return 'border-yellow-300 bg-yellow-50';
      case 'high': return 'border-red-300 bg-red-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  // 애니메이션 효과를 위한 노드 스타일 계산
  const getNodeStyle = useCallback((node: Node) => {
    const isSelected = selectedNode === node.id;
    const isHovered = hoveredNode === node.id;
    const isDragging = dragging === node.id;
    const isConnecting = connecting === node.id;
    
    let transform = `translate(${node.x}px, ${node.y}px) scale(${zoom})`;
    let transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
    
    if (isDragging) {
      transform += ' scale(1.05)';
      transition = 'none';
    } else if (isHovered) {
      transform += ' scale(1.02)';
    }

    return {
      transform,
      transition,
      zIndex: isDragging ? 1000 : isSelected ? 100 : isHovered ? 50 : 1,
      filter: isDragging ? 'drop-shadow(0 10px 25px rgba(0,0,0,0.3))' : 
              isSelected ? 'drop-shadow(0 4px 15px rgba(59,130,246,0.4))' :
              isHovered ? 'drop-shadow(0 2px 10px rgba(0,0,0,0.15))' : 'none'
    };
  }, [selectedNode, hoveredNode, dragging, connecting, zoom]);

  // 개선된 마우스 이벤트 핸들러들
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.shiftKey) {
      if (connecting) {
        if (connecting !== nodeId) {
          setNodes(prev => prev.map(node => 
            node.id === connecting 
              ? { ...node, connections: [...new Set([...node.connections, nodeId])] }
              : node
          ));
        }
        setConnecting(null);
      } else {
        setConnecting(nodeId);
      }
    } else {
      // 드래그 시작 시 마우스와 노드 중심점의 오프셋 계산
      const nodeElement = e.currentTarget as HTMLElement;
      const rect = nodeElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      setDragOffset({
        x: e.clientX - centerX,
        y: e.clientY - centerY
      });
      
      setDragging(nodeId);
      setSelectedNode(nodeId);
    }
  }, [connecting]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      // 드래그 오프셋을 고려한 자연스러운 위치 계산
      const x = (e.clientX - dragOffset.x - rect.left - pan.x) / zoom;
      const y = (e.clientY - dragOffset.y - rect.top - pan.y) / zoom;
      
      // 드롭 타겟 검사 (스크래치 스타일)
      const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY);
      let newDropTarget: string | null = null;
      
      for (const element of elementsUnderMouse) {
        const nodeId = element.getAttribute('data-node-id');
        if (nodeId && nodeId !== dragging && canDropInside(dragging, nodeId)) {
          newDropTarget = nodeId;
          break;
        }
      }
      
      setDropTarget(newDropTarget);
      
      setNodes(prev => prev.map(node => 
        node.id === dragging ? { ...node, x, y } : node
      ));
    }
  }, [dragging, dragOffset, zoom, pan, canDropInside]);

  const handleMouseUp = useCallback(() => {
    if (dragging && dropTarget) {
      // 스크래치 스타일 드롭 처리
      setNodes(prev => prev.map(node => {
        if (node.id === dropTarget) {
          return {
            ...node,
            childrenIds: [...(node.childrenIds || []), dragging],
            connections: [...new Set([...node.connections, dragging])]
          };
        }
        if (node.id === dragging) {
          return {
            ...node,
            parentId: dropTarget
          };
        }
        return node;
      }));
    }
    
    setDragging(null);
    setDropTarget(null);
    setDragOffset({ x: 0, y: 0 });
  }, [dragging, dropTarget]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedNode && selectedNode !== 'app') {
        deleteNode(selectedNode);
      } else if (e.key === 'Escape') {
        setSelectedNode(null);
        setConnecting(null);
      } else if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setViewMode(prev => prev === 'design' ? 'code' : prev === 'code' ? 'analytics' : 'design');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);

  // 마우스 이벤트 리스너
  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // 캔버스 크기 조정
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  const addNode = () => {
    if (!newNodeName.trim()) return;
    
    const newNode: Node = {
      id: Date.now().toString(),
      name: newNodeName,
      codetype: newNodeType,
      description: newNodeDescription,
      complexity: newNodeComplexity,
      x: 400 + Math.random() * 200 - 100,
      y: 300 + Math.random() * 200 - 100,
      connections: [],
      expanded: false,
      childrenIds: []
    };

    setNodes(prev => [...prev, newNode]);
    setNewNodeName('');
    setNewNodeDescription('');
    setShowAddForm(false);
  };

  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId).map(node => ({
      ...node,
      connections: node.connections.filter(id => id !== nodeId)
    })));
    setSelectedNode(null);
  };

  const toggleNodeExpansion = (nodeId: string) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, expanded: !node.expanded } : node
    ));
  };

  // 연결선 렌더링 (개선된 버전)
  const renderConnections = () => {
    const lines: JSX.Element[] = [];
    filteredNodes.forEach(node => {
      node.connections.forEach(connectionId => {
        const targetNode = filteredNodes.find(n => n.id === connectionId);
        if (targetNode) {
          const isHighlighted = selectedNode === node.id || selectedNode === connectionId ||
                               hoveredNode === node.id || hoveredNode === connectionId;
          
          lines.push(
            <g key={`${node.id}-${connectionId}`}>
              <line
                x1={node.x + 75}
                y1={node.y + 25}
                x2={targetNode.x + 75}
                y2={targetNode.y + 25}
                stroke={isHighlighted ? "#3b82f6" : "#6b7280"}
                strokeWidth={isHighlighted ? "3" : "2"}
                strokeDasharray="5,5"
                opacity={isHighlighted ? "0.8" : "0.4"}
                className="transition-all duration-200"
              />
              <circle
                cx={(node.x + targetNode.x) / 2 + 75}
                cy={(node.y + targetNode.y) / 2 + 25}
                r="3"
                fill={isHighlighted ? "#3b82f6" : "#6b7280"}
                opacity={isHighlighted ? "1" : "0.6"}
                className="transition-all duration-200"
              />
            </g>
          );
        }
      });
    });
    return lines;
  };

  // JSON 생성 (개선된 버전)
  const generateJSON = () => {
    const buildTree = (nodeId: string, visited = new Set<string>()): any => {
      if (visited.has(nodeId)) return null;
      visited.add(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return null;
      
      return {
        id: node.id,
        name: node.name,
        codetype: node.codetype,
        description: node.description,
        complexity: node.complexity,
        position: { x: node.x, y: node.y },
        children: node.connections.map(id => buildTree(id, visited)).filter(Boolean)
      };
    };
    
    return buildTree('app');
  };

  // 분석 데이터 생성 (3계층 구조 반영)
  const generateAnalytics = (): Analytics => {
    const totalNodes = nodes.length;
    const viewNodes = nodes.filter(n => n.codetype === 'view').length;
    const componentNodes = nodes.filter(n => n.codetype === 'component').length;
    const functionNodes = nodes.filter(n => n.codetype === 'function').length;
    const complexityCount = {
      low: nodes.filter(n => n.complexity === 'low').length,
      medium: nodes.filter(n => n.complexity === 'medium').length,
      high: nodes.filter(n => n.complexity === 'high').length
    };
    
    const maxDepth = Math.max(...nodes.map(n => n.y)) - Math.min(...nodes.map(n => n.y));
    const avgConnections = nodes.reduce((sum, n) => sum + n.connections.length, 0) / totalNodes;
    
    return {
      totalNodes,
      viewNodes,
      componentNodes,
      functionNodes,
      complexityCount,
      maxDepth: Math.round(maxDepth / 150),
      avgConnections: avgConnections.toFixed(1)
    };
  };

  const analytics = generateAnalytics();

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden">
      {/* 개선된 상단 툴바 */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Flutter 앱 설계 도구
            </h1>
            <p className="text-sm text-gray-600">
              드래그: 이동 • Shift+클릭: 연결 • Del: 삭제 • Space: 뷰 전환
            </p>
          </div>
          
          {/* 검색 및 필터 */}
          <div className="flex items-center gap-2 ml-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="노드 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'view' | 'component' | 'function')}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">전체</option>
              <option value="view">View</option>
              <option value="component">Component</option>
              <option value="function">Function</option>
            </select>
          </div>
        </div>

        {/* 뷰 모드 전환 및 액션 버튼들 */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['design', 'code', 'analytics'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  viewMode === mode 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode === 'design' ? '설계' : mode === 'code' ? '코드' : '분석'}
              </button>
            ))}
          </div>
          
          <div className="h-6 w-px bg-gray-300 mx-2" />
          
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-sm"
          >
            <Plus size={16} />
            노드 추가
          </button>
        </div>
      </div>

      <div className="flex h-full">
        {/* 메인 캔버스 */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1" opacity="0.5"/>
              </pattern>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {renderConnections()}
            </g>
          </svg>

          {/* 노드들 (개선된 렌더링 - 3계층 구조) */}
          {filteredNodes.map(node => (
            <div
              key={node.id}
              className="absolute select-none cursor-move"
              style={getNodeStyle(node)}
              data-node-id={node.id}
              onMouseDown={(e) => handleMouseDown(e, node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (node.id !== 'app') deleteNode(node.id);
              }}
            >
              <div className={`
                relative w-40 min-h-16 rounded-xl shadow-lg border-2 p-3 backdrop-blur-sm transition-all duration-200
                ${node.codetype === 'view' 
                  ? 'bg-gradient-to-br from-purple-500 to-purple-600 border-purple-400 text-white' 
                  : node.codetype === 'component'
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400 text-white'
                  : 'bg-gradient-to-br from-green-500 to-green-600 border-green-400 text-white'
                }
                ${selectedNode === node.id ? 'ring-4 ring-blue-400/50' : ''}
                ${connecting === node.id ? 'ring-4 ring-yellow-400/50' : ''}
                ${dropTarget === node.id ? 'ring-4 ring-orange-400/70 scale-105' : ''}
                ${node.complexity ? getComplexityColor(node.complexity) : ''}
              `}>
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {node.codetype === 'view' ? <Eye size={16} /> : 
                     node.codetype === 'component' ? <Move size={16} /> : <Code size={16} />}
                    <span className="font-medium text-sm truncate">{node.name}</span>
                  </div>
                  
                  {node.description && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNodeExpansion(node.id);
                      }}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                </div>

                {/* 확장된 정보 */}
                {node.expanded && node.description && (
                  <div className="text-xs text-white/90 mb-2 p-2 bg-black/20 rounded-lg">
                    {node.description}
                  </div>
                )}

                {/* 복잡도 표시 */}
                {node.complexity && (
                  <div className="absolute -top-2 -right-2">
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${node.complexity === 'low' ? 'bg-green-500' : 
                        node.complexity === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}
                    `}>
                      {node.complexity === 'low' ? 'L' : node.complexity === 'medium' ? 'M' : 'H'}
                    </div>
                  </div>
                )}

                {/* 연결점들 */}
                <div className="absolute -right-2 top-1/2 w-4 h-4 bg-white border-2 border-gray-300 rounded-full transform -translate-y-1/2 shadow-sm"></div>
                <div className="absolute -left-2 top-1/2 w-4 h-4 bg-white border-2 border-gray-300 rounded-full transform -translate-y-1/2 shadow-sm"></div>
              </div>
            </div>
          ))}
        </div>

        {/* 사이드 패널 (뷰 모드에 따라 다른 내용) */}
        <div className="w-96 bg-white/90 backdrop-blur-sm border-l border-gray-200 overflow-auto">
          {viewMode === 'design' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="text-blue-500" size={20} />
                설계 정보
              </h3>
              
              {selectedNode && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">선택된 노드</h4>
                    <p className="text-blue-800">{nodes.find(n => n.id === selectedNode)?.name}</p>
                    {nodes.find(n => n.id === selectedNode)?.description && (
                      <p className="text-sm text-blue-600 mt-1">
                        {nodes.find(n => n.id === selectedNode)?.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <div className="mt-6">
                <h4 className="font-medium mb-3">생성된 JSON</h4>
                <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-auto">
                  <pre className="text-xs text-gray-700">
                    {JSON.stringify(generateJSON(), null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'code' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Code className="text-green-500" size={20} />
                코드 생성
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">Flutter Widget 구조</h4>
                  <div className="bg-white p-3 rounded border text-sm font-mono overflow-auto max-h-64">
                    <div className="text-gray-600">
                      {`class ${generateJSON()?.name || 'MyApp'}Widget extends StatelessWidget {\n`}
                      {`  @override\n`}
                      {`  Widget build(BuildContext context) {\n`}
                      {`    return Scaffold(\n`}
                      {`      // Generated from design\n`}
                      {`    );\n`}
                      {`  }\n`}
                      {`}`}
                    </div>
                  </div>
                </div>
                
                <button className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                  전체 코드 생성
                </button>
              </div>
            </div>
          )}

          {viewMode === 'analytics' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="text-purple-500" size={20} />
                프로젝트 분석
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-purple-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">{analytics.totalNodes}</div>
                    <div className="text-sm text-purple-500">총 노드</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{analytics.maxDepth}</div>
                    <div className="text-sm text-blue-500">최대 깊이</div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">노드 유형 분포</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-purple-600">View</span>
                      <span className="font-medium">{analytics.viewNodes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Component</span>
                      <span className="font-medium">{analytics.componentNodes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Function</span>
                      <span className="font-medium">{analytics.functionNodes}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">복잡도 분석</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-600">낮음</span>
                      <span className="font-medium">{analytics.complexityCount.low}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600">보통</span>
                      <span className="font-medium">{analytics.complexityCount.medium}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">높음</span>
                      <span className="font-medium">{analytics.complexityCount.high}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 개선된 노드 추가 모달 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-96 border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="text-blue-500" size={20} />
              새 노드 추가
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="노드 이름"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addNode()}
              />
              
              <textarea
                value={newNodeDescription}
                onChange={(e) => setNewNodeDescription(e.target.value)}
                placeholder="설명 (선택사항)"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              />
              
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value as 'view' | 'component' | 'function')}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="view">View (보라색)</option>
                  <option value="component">Component (파란색)</option>
                  <option value="function">Function (녹색)</option>
                </select>
                
                <select
                  value={newNodeComplexity}
                  onChange={(e) => setNewNodeComplexity(e.target.value as 'low' | 'medium' | 'high')}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">낮은 복잡도</option>
                  <option value="medium">보통 복잡도</option>
                  <option value="high">높은 복잡도</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={addNode}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  추가
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 미니맵 */}
      <div className="fixed bottom-4 right-4 w-48 h-32 bg-white/90 backdrop-blur-sm rounded-lg border shadow-lg p-2">
        <div className="text-xs font-medium text-gray-600 mb-1">미니맵</div>
        <div className="relative w-full h-full bg-gray-100 rounded overflow-hidden">
          {filteredNodes.map(node => (
            <div
              key={node.id}
              className={`absolute w-2 h-2 rounded-full ${
                node.codetype === 'view' ? 'bg-purple-400' : 'bg-green-400'
              }`}
              style={{
                left: `${(node.x / 1000) * 100}%`,
                top: `${(node.y / 800) * 100}%`
              }}
            />
          ))}
        </div>
      </div>

      {/* 범례 (개선된 버전) */}
      <div className="fixed left-4 bottom-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border">
        <h4 className="font-semibold mb-3 text-gray-800">범례</h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded"></div>
            <span>View (페이지)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded"></div>
            <span>Component (UI 요소)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-green-600 rounded"></div>
            <span>Function (기능 로직)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
            <span>복잡도 (L/M/H)</span>
          </div>
          <div className="text-xs text-gray-600 mt-3 pt-3 border-t">
            <div>• 드래그: 노드 이동 & 드롭</div>
            <div>• Shift+클릭: 연결 생성</div>
            <div>• 우클릭: 삭제</div>
            <div>• Space: 뷰 전환</div>
            <div className="mt-2 text-orange-600 font-medium">
              🎯 스크래치 스타일 드롭!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedFlutterDesigner;