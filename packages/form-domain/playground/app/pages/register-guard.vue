<script setup lang="ts">
import { computed } from 'vue'
import { object, string } from 'yup'

/**
 * Type fixture for the two surfaces a consuming project actually touches:
 * `register()` and `shape`. Every `@ts-expect-error` here is a guarantee — if
 * one stops erroring, the directive goes unused and typecheck fails.
 */

const { register, shape } = createFormDomain('register-guard')
  .withFields({
    username: field({ label: 'Username', value: '' }),
    profile: field({
      label: 'Profile',
      value: '',
      placeholder: 'pick one',
      options: [{ label: 'Lawyer', value: 'lawyer' }],
    }),
  })
  .withSchema({
    username: string().required(),
    profile: string().required(),
  })
  .use()

/**
 * The reason `shape` keeps the declared validator types: `object()` wants yup's
 * own schema type. With the types erased to `StandardSchemaV1` this line was
 * the error every consuming project hit first.
 */
const validation = computed(() => object(shape.value))

/**
 * No `canShow` rule in this domain, so nothing can drop out of `shape` and the
 * keys stay required. A fully `Partial` shape would make the `object()` above
 * stop compiling.
 */
void shape.value.username.required

const usernameBindings = register('username')
const profileBindings = register('profile')

/**
 * The binding has to survive a component declaring `defineModel<string>()`,
 * which emits `string | undefined`. Under `strictFunctionTypes` a handler
 * taking only `string` is not assignable to that.
 */
const handler: (value: string | undefined) => void = usernameBindings['onUpdate:modelValue']
void handler

/** A field that declares options gets the key... */
void profileBindings.options
void profileBindings.placeholder

// @ts-expect-error ...and one that declares none doesn't get it at all
void usernameBindings.options

// @ts-expect-error same for placeholder, absent from the definition
void usernameBindings.placeholder

// @ts-expect-error and for mask, which no field here declares
void profileBindings.mask

/** Derived options live in `rules`, and must reach the bindings from there. */
const derived = createFormDomain('register-guard-derived')
  .withFields({
    state: field({ label: 'State', value: '' }),
    city: field({ label: 'City', value: '' }),
  })
  .withRules({
    city: { options: ctx => (ctx.values.state ? [{ label: 'Recife', value: 'recife' }] : []) },
  })
  .use()

void derived.register('city').options

// @ts-expect-error no rule and no static list: the key does not exist
void derived.register('state').options

/** A field a `canShow` can hide is the one case where `shape` may not carry it. */
const conditional = createFormDomain('register-guard-conditional')
  .withFields({
    kind: field({ label: 'Kind', value: '' }),
    cpf: field({ label: 'CPF', value: '' }),
  })
  .withRules({
    cpf: { canShow: ctx => ctx.values.kind === 'PF' },
  })
  .withSchema({
    kind: string().required(),
    cpf: string().required(),
  })
  .use()

void conditional.shape.value.kind.required

// @ts-expect-error `canShow` can hide it, so the key is optional in `shape`
void conditional.shape.value.cpf.required

/** An option whose value doesn't match the field's is still a compile error. */
createFormDomain('register-guard-options')
  .withFields({
    // @ts-expect-error the field holds a string; this option holds a number
    quantity: field({ label: 'Quantity', value: '', options: [{ label: 'One', value: 1 }] }),
  })
  .use()
</script>

<template>
  <div>
    <ModelInput v-bind="register('username')" />
    <ModelInput v-bind="register('profile')" />
    <pre>{{ validation.describe() }}</pre>
  </div>
</template>
