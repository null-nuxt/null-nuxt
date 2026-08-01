<script setup lang="ts">
/**
 * Type fixture for `register()`. Every assertion here is a guarantee — if one
 * stops holding, typecheck fails instead of the breakage reaching a project.
 */

const { register } = createFormDomain('register-guard')
  .withFields({
    username: field({ label: 'Username', value: '' }),
  })
  .use()

/**
 * The binding has to survive a component declaring `defineModel<string>()`,
 * which emits `string | undefined`. Under `strictFunctionTypes` a handler
 * taking only `string` is not assignable to that.
 */
const handler: (value: string | undefined) => void = register('username')['onUpdate:modelValue']
void handler
</script>

<template>
  <div>
    <ModelInput v-bind="register('username')" />
  </div>
</template>
