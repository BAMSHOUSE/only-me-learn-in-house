import { Stethoscope, GraduationCap, ChefHat, HardHat, Palette, Plane, Code2, Scale, Camera, Microscope, Sprout, BriefcaseBusiness } from "lucide-react";
import type { CSSProperties } from "react";
const careers = [
  {icon:Stethoscope,ink:"#397d98",wash:"#e7f4fa"},
  {icon:GraduationCap,ink:"#7962aa",wash:"#f0ebfa"},
  {icon:ChefHat,ink:"#b67545",wash:"#fff0e1"},
  {icon:HardHat,ink:"#a48632",wash:"#fbf4d8"},
  {icon:Palette,ink:"#ae6284",wash:"#fbeaf2"},
  {icon:Plane,ink:"#4c7cb1",wash:"#e9f2fc"},
  {icon:Code2,ink:"#626fb3",wash:"#edf0fd"},
  {icon:Scale,ink:"#8a738d",wash:"#f3edf4"},
  {icon:Camera,ink:"#558c87",wash:"#e7f5f1"},
  {icon:Microscope,ink:"#6e8d4b",wash:"#eef5e2"},
  {icon:Sprout,ink:"#47876c",wash:"#e8f5eb"},
  {icon:BriefcaseBusiness,ink:"#94734e",wash:"#f7f0e7"},
];
export default function MonthArt({index}:{index:number}) {
  const {icon:Icon,ink,wash}=careers[index];
  return <span className={"month-art art-"+index} aria-hidden="true" style={{"--art-ink":ink,"--art-wash":wash} as CSSProperties}><span className="art-orbit"/><span className="art-shape"/><Icon className="career-icon" size={44} strokeWidth={1.55}/><span className="art-dot dot-one"/><span className="art-dot dot-two"/><span className="art-cross">+</span></span>;
}
