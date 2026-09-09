import type { SVGProps } from 'react';
import paths from '../assets/brand-icons.json';

export type IconName = keyof typeof paths;
type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName;
  size?: number;
};

/** Decorative companion to a visible label; name icon-only buttons on the button. */
export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" {...props}
    >
      {paths[name].map((d, index) => <path key={index} d={d} />)}
    </svg>
  );
}
