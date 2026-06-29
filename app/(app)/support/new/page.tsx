import { NewTicketForm } from './new-ticket-form'

export default function NewTicketPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Support Ticket</h1>
        <p className="text-sm text-muted-foreground mt-1">Describe your issue and our team will get back to you.</p>
      </div>
      <NewTicketForm />
    </div>
  )
}
