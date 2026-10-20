import React from 'react';
import { View, ViewStyle } from 'react-native';
import { iconSizes } from '../tokens/layout';
import {
  Home,
  Compass,
  Zap,
  Calendar,
  ClipboardList,
  IndianRupee,
  Wallet,
  User,
  Bell,
  MapPin,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Check,
  X,
  AlertCircle,
  Info,
  RotateCcw,
  Plus,
  LogOut,
  Trash2,
  Briefcase,
  Users,
  FileText,
  Settings,
  LucideProps,
} from 'lucide-react-native';

export type IconName =
  | 'home'
  | 'discover'
  | 'zap'
  | 'shifts'
  | 'calendar'
  | 'earnings'
  | 'wallet'
  | 'profile'
  | 'notifications'
  | 'location'
  | 'time'
  | 'verified'
  | 'chevron-left'
  | 'chevron-right'
  | 'search'
  | 'filter'
  | 'check'
  | 'close'
  | 'alert'
  | 'info'
  | 'refresh'
  | 'plus'
  | 'logout'
  | 'trash'
  | 'briefcase'
  | 'users'
  | 'document'
  | 'settings';

export interface OpsklIconProps {
  name: IconName;
  size?: 'sm' | 'md' | 'lg' | number;
  color?: string;
  strokeWidth?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const SIZE_MAP = {
  sm: iconSizes.sm,
  md: iconSizes.md,
  lg: iconSizes.lg,
};

export const OpsklIcon: React.FC<OpsklIconProps> = ({
  name,
  size = 'md',
  color = '#111111',
  strokeWidth = 2,
  style,
  accessibilityLabel,
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 20;
  const iconProps: LucideProps = {
    size: pixelSize,
    color,
    strokeWidth,
  };

  const renderIcon = () => {
    switch (name) {
      case 'home':
        return <Home {...iconProps} />;
      case 'discover':
        return <Compass {...iconProps} />;
      case 'zap':
        return <Zap {...iconProps} />;
      case 'shifts':
        return <ClipboardList {...iconProps} />;
      case 'calendar':
        return <Calendar {...iconProps} />;
      case 'earnings':
        return <IndianRupee {...iconProps} />;
      case 'wallet':
        return <Wallet {...iconProps} />;
      case 'profile':
        return <User {...iconProps} />;
      case 'notifications':
        return <Bell {...iconProps} />;
      case 'location':
        return <MapPin {...iconProps} />;
      case 'time':
        return <Clock {...iconProps} />;
      case 'verified':
        return <ShieldCheck {...iconProps} />;
      case 'chevron-left':
        return <ChevronLeft {...iconProps} />;
      case 'chevron-right':
        return <ChevronRight {...iconProps} />;
      case 'search':
        return <Search {...iconProps} />;
      case 'filter':
        return <SlidersHorizontal {...iconProps} />;
      case 'check':
        return <Check {...iconProps} />;
      case 'close':
        return <X {...iconProps} />;
      case 'alert':
        return <AlertCircle {...iconProps} />;
      case 'info':
        return <Info {...iconProps} />;
      case 'refresh':
        return <RotateCcw {...iconProps} />;
      case 'plus':
        return <Plus {...iconProps} />;
      case 'logout':
        return <LogOut {...iconProps} />;
      case 'trash':
        return <Trash2 {...iconProps} />;
      case 'briefcase':
        return <Briefcase {...iconProps} />;
      case 'users':
        return <Users {...iconProps} />;
      case 'document':
        return <FileText {...iconProps} />;
      case 'settings':
        return <Settings {...iconProps} />;
      default:
        return <Info {...iconProps} />;
    }
  };

  return (
    <View
      style={[{ alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || name}
    >
      {renderIcon()}
    </View>
  );
};

export {
  Home,
  Compass,
  Zap,
  Calendar,
  ClipboardList,
  IndianRupee,
  Wallet,
  User,
  Bell,
  MapPin,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Check,
  X,
  AlertCircle,
  Info,
  RotateCcw,
  Plus,
  LogOut,
  Trash2,
  Briefcase,
  Users,
  FileText,
  Settings,
};
