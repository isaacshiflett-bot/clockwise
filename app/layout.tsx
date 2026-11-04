import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'Clockwise | Time tracking',description:'A simple time clock and scheduling insights for small teams'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
