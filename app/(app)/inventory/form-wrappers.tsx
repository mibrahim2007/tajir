'use client'

import dynamic from 'next/dynamic'

type Lot = {
  id: string
  name: string
  code: string | null
  count: string
  type: string | null
  fiber: string | null
  lot: string | null
}

const CreateLotFormDynamic = dynamic(
  () => import('./create-lot-form').then((m) => ({ default: m.CreateLotForm })),
  { ssr: false, loading: () => null }
)

const EditInventoryLotFormDynamic = dynamic(
  () => import('./edit-inventory-lot-form').then((m) => ({ default: m.EditInventoryLotForm })),
  { ssr: false, loading: () => null }
)

export function CreateLotFormWrapper() {
  return <CreateLotFormDynamic />
}

export function EditInventoryLotFormWrapper({ lot }: { lot: Lot }) {
  return <EditInventoryLotFormDynamic lot={lot} />
}
