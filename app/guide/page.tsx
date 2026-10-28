import Link from 'next/link';
import { basePath } from '@/lib/shared';
export default function Guide() {
  return <main className="story-document"><h1>Write a VisDelta story</h1>
    <p>Write prose and components in story.mdx, declare native VisDelta charts in chart.js, and keep records in data.json.</p>
    <h2>Start with chart states</h2><pre>{`import { chart } from './chart.js'

<Scrolly>
<Step chart={chart}>The whole picture.</Step>
<Step chart={chart.highlight({ region: 'North' })}>Focus on North.</Step>
</Scrolly>`}</pre>
    <p>Entering a Step plays to its chart state. Scroll backward to reverse. Use <code>playback=&quot;scrub&quot;</code> on Scrolly for continuous scrolling.</p>
    <h2>Add shared variables</h2><p>Story and Var declare values; Range, DatePicker and Select bind to them. StoryData supplies named views, computed values and conditions. Value displays numbers in prose. The Energy and Weather examples demonstrate these bindings without authoring hooks.</p>
    <h2>Customize the article</h2><p>Native HTML, className, inline styles and live Tailwind utilities work in MDX. Sticky keeps controls above the chart.</p>
    <h2>Save your work</h2><p>Save project downloads all three files together; Open restores a saved project. Export MDX downloads only the story source. Drafts live on this browser origin. Run only trusted projects: authored JavaScript executes with the page permissions.</p>
    <p><a href={`${basePath}/authoring.mdx`} download>Download the complete authoring reference</a></p>
    <p><Link href="/story/">Open the editor →</Link></p>
  </main>;
}
