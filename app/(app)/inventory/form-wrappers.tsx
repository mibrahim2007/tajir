'use client'

import dynamic from 'next/dynamic'

type ItemType = { id: string; name: string }

type Lot = {
  id: string
  name: string
  code: string | null
  count: string
  itemTypeId: string | null
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

export function CreateLotFormWrapper({ itemTypes }: { itemTypes: ItemType[] }) {
  return <CreateLotFormDynamic itemTypes={itemTypes} />
}

export function EditInventoryLotFormWrapper({ lot, itemTypes }: { lot: Lot; itemTypes: ItemType[] }) {
  return <EditInventoryLotFormDynamic lot={lot} itemTypes={itemTypes} />
}
