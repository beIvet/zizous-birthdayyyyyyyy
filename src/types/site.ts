export type ElementType = 'image' | 'video' | 'text' | 'button' | 'shape' | 'group' | 'embed';

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextStyle {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right' | string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  letterSpacing: string;
  lineHeight: string;
  spanLink?: string | null;
  textShadow?: string | null;
}

export interface ButtonStyle extends TextStyle {
  backgroundColor: string;
  borderRadius: number;
}

export interface MediaConfig {
  src: string;
  maskSrc?: string | null;
  isGif?: boolean;
  loop?: boolean;
  volume?: number;
  trimEndSec?: number | null;
  crop?: CropBox | null;
  flipX?: boolean;
  flipY?: boolean;
  borderRadius?: number;
}

export interface ShapePath {
  d: string;
  fill: string;
  cornerRadius: number;
  stroke?: string | null;
  strokeWidth?: number;
}

export interface ShapeConfig {
  viewBox: string;
  isRect: boolean;
  paths: ShapePath[];
}

export interface GroupConfig {
  internalWidth: number;
  internalHeight: number;
  children: CanvasElement[];
}

export interface EmbedConfig {
  provider: 'spotify-playlist' | 'spotify-track' | 'youtube' | 'iframe' | string;
  embedUrl: string;
  originalUrl: string;
}

export interface AnimationConfig {
  type: 'fade' | 'pop' | 'pan' | 'rise' | 'scrapbook' | 'typewriter' | 'breathe' | 'none';
  direction?: 'left' | 'right' | 'up' | 'down' | 'in';
  duration?: number;
  delay?: number;
  loop?: boolean;
  intensity?: number;
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  link?: string | null;
  dropShadow?: string | null;
  animation?: AnimationConfig | null;
  textStyle?: TextStyle;
  buttonStyle?: ButtonStyle;
  media?: MediaConfig;
  shape?: ShapeConfig;
  group?: GroupConfig;
  embed?: EmbedConfig;
}

export interface CanvaSubpage {
  id: string;
  width: number;
  height: number;
  backgroundColor: string;
  elements: CanvasElement[];
}

export interface CanvaPage {
  id: string;
  index: number;
  slug: string;
  anchor: string;
  name: string;
  subpages: CanvaSubpage[];
}

export interface BackgroundMusicConfig {
  enabled: boolean;
  url: string;
  title?: string;
  volume: number;
  loop: boolean;
  autoplay: boolean;
}

export interface SaveSnapshot {
  id: string;
  timestamp: number;
  dateFormatted: string;
  title: string;
  pageCount: number;
  data: SiteData;
}

export interface SiteData {
  title: string;
  canvasWidth: number;
  canvasHeight: number;
  audioTrack?: string;
  backgroundMusic?: BackgroundMusicConfig;
  lastSavedAt?: number;
  fonts: string[];
  pages: CanvaPage[];
}

export interface SelectedElementRef {
  subpageIndex: number;
  elementId: string;
}
