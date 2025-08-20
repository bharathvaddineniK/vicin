import {
    Calendar,
    Clock,
    Fire,
    HandHeart,
    Info,
    MapPin,
    Question,
    Star,
    TrendUp,
    Users,
} from "phosphor-react-native";
import React from "react";

interface TileIconProps {
  iconName: string;
  size: number;
  weight: "regular" | "bold";
  color: string;
}

export default function TileIcon({ iconName, size, weight, color }: TileIconProps) {
  const iconProps = { size, weight, color };

  switch (iconName) {
    case "Info":
      return <Info {...iconProps} />;
    case "Clock":
      return <Clock {...iconProps} />;
    case "Question":
      return <Question {...iconProps} />;
    case "Users":
      return <Users {...iconProps} />;
    case "Calendar":
      return <Calendar {...iconProps} />;
    case "HandHeart":
      return <HandHeart {...iconProps} />;
    case "TrendUp":
      return <TrendUp {...iconProps} />;
    case "Star":
      return <Star {...iconProps} />;
    case "MapPin":
      return <MapPin {...iconProps} />;
    case "Fire":
      return <Fire {...iconProps} />;
    default:
      return <Info {...iconProps} />;
  }
}
