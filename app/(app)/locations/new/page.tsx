import { CreateLocationForm } from './create-location-form'

export default function NewLocationPage() {
  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Location</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a warehouse, shop, or storage point.</p>
      </div>
      <CreateLocationForm />
    </div>
  )
}
