import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'Clockwise | Shipping operations',description:'Timecards, shipping assignments, callout coverage, and leadership updates'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
