import { useState } from 'react'
import { useStore } from '../lib/store'
import { projectSummary } from '../lib/derive'
import { ProjectCard } from '../components/Cards'
import { Tabs } from '../components/ui'

export default function Projects() {
  const { projects, units, settings } = useStore()
  const [cat, setCat] = useState('All')
  const list = projects.filter((p) => cat === 'All' || p.category === cat || (cat === 'Ongoing' && p.status !== 'Ready to Move') || (cat === 'Ready' && p.status === 'Ready to Move'))
  return (
    <>
      <section className="page-hero"><div className="wrap"><span className="eyebrow light">Portfolio</span><h1>Our projects in Narsingi</h1><p className="lead">Residential communities, villas, plots, offices and retail — all RERA registered.</p></div></section>
      <section className="wrap section">
        <Tabs value={cat} onChange={setCat} tabs={['All', 'Residential', 'Commercial', 'Plots', 'Ongoing', 'Ready']} />
        <div className="grid-3 mt">{list.map((p) => <ProjectCard key={p.id} project={p} summary={projectSummary(p, units, settings.taxes)} />)}</div>
      </section>
    </>
  )
}
