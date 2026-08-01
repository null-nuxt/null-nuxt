<script setup lang="ts">
import { computed } from 'vue'
import { object, string } from 'yup'

/**
 * Type fixture for the domain. Every `@ts-expect-error` here is a guarantee: if
 * one stops holding, the directive goes unused and typecheck fails.
 */

const declared = refFields({
  username: { label: 'Username', value: '' },
  personType: { label: 'Type', value: '' as 'PF' | 'PJ' | '' },
  profile: {
    label: 'Profile',
    value: '',
    placeholder: 'pick one',
    options: [{ label: 'Lawyer', value: 'adv' }],
  },
})

addRules(declared, {
  username: { canShow: () => declared.personType.value === 'PF', clearWhenHidden: true },
})

// @ts-expect-error a field that isn't in fields
addRules(declared, { surname: { canShow: () => true } })

addSchemas(declared, { username: string().required() })

// @ts-expect-error validating a field that doesn't exist makes no sense
addSchemas(declared, { surname: string().required() })

const form = toForm(declared)

/** The value keeps its declared union, all the way through `values`. */
const personType: 'PF' | 'PJ' | '' = form.values.value.personType
void personType

// @ts-expect-error a field outside fields
form.register('surname')

/** A field that declares extras gets the keys... */
void form.register('profile').options
void form.register('profile').placeholder

// @ts-expect-error ...and one that declares none gets nothing
void form.register('username').options

// @ts-expect-error same for placeholder
void form.register('username').placeholder

/** The handler has to serve a component declaring `defineModel<string>()`. */
const handler: (value: string | undefined) => void = form.register('username')['onUpdate:modelValue']
void handler

/** `shape` keeps yup's own type, so it composes. */
const schema = form.composeSchema(object)
void schema.value.describe

/** `selected` comes off the engine, with no need for the raw fields. */
const chosen: string | undefined = form.selected.value.profile?.label
void chosen

// @ts-expect-error a field outside fields
void form.selected.value.surname

/** `visible` is partial; `values` is complete. */
const partial: string | undefined = form.visible.value.username
const complete: string = form.values.value.username
void partial
void complete

/**
 * An option's value has to match the field carrying it. That held through
 * `refField()` and NOT through `refFields()` — the common path — because the
 * record is keyed with `any`. Without it the select renders choices that can
 * never match: `selected` never resolves and a `oneOf` rejects everything the
 * user picks.
 */
refFields({
  // @ts-expect-error the field holds a string; this option holds a number
  quantity: { label: 'Quantity', value: '', options: [{ label: 'One', value: 1 }] },
})

refFields({
  quantity: {
    label: 'Quantity',
    value: '' as 'one' | 'two' | '',
    // the field's union accepts an option from the same union
    options: [{ label: 'One', value: 'one' as const }],
  },
})

/** A standalone field sits next to the declarations and keeps its precision. */
const sharedCpf = refField({ label: 'CPF', value: '', mask: 'cpf' })
const withStandalone = toForm(refFields({ cpf: sharedCpf, name: { label: 'Name', value: '' } }))

void withStandalone.register('cpf').mask

// @ts-expect-error the standalone field declared no placeholder
void withStandalone.register('cpf').placeholder

/** Domain: metadata comes off the factory, with no instance. */
const domain = defineFormDomain('domain-guard', { title: 'Guarda', order: 1 }, () => {
  const f = refFields({ name: { label: 'Name', value: '' } })
  return { fields: f, shouted: computed(() => f.name.value.toUpperCase()) }
}).payload(ctx => ({ ...ctx.visible, shouted: ctx.shouted.value }))

const title: string = domain.metadata.title
void title

const instance = domain()

/** What the setup exposed beyond the fields arrives typed. */
const shouted: string = instance.shouted.value
void shouted

/** And the projection keeps the type of what was projected. */
const projected: string = instance.payload.value.shouted
void projected

// @ts-expect-error the payload declares no such key
void instance.payload.value.doesNotExist

/** Metadata is optional. */
const noMetadata = defineFormDomain('domain-guard-no-metadata', () => ({
  fields: refFields({ name: { label: 'Name', value: '' } }),
}))

const name: string = noMetadata().values.value.name
void name
</script>

<template>
  <div>
    <!-- the case that started it all: v-bind onto a defineModel<string>() component -->
    <ModelInput v-bind="form.register('username')" />
    <ModelInput v-bind="form.register('profile')" />
    {{ personType }} {{ partial }} {{ complete }} {{ title }} {{ shouted }} {{ projected }} {{ name }}
  </div>
</template>
