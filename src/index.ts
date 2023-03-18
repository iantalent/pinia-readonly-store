import {defineStore, skipHydrate} from "pinia";
import {DeepReadonly, reactive, readonly, ToRefs, toRefs, UnwrapNestedRefs} from "vue-demi";

export interface ReadonlyStoreOptions<I extends string, T extends ReadonlyStoreStateProp, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}>
{
	id: I
	state: () => T
	getters?: (state: T) => C // TODO make state independent. just play object of getters
	actions?: (state: T) => A // TODO make state independent. just play object of actions
}

type ToRefsDeepReadOnly<T> = ToRefs<DeepReadonly<T>>

export type ReadonlyStore<T extends ReadonlyStoreStateProp = {}, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}> =
	ReadonlyStoreState<T> & ReadonlyStoreGetters<C> & ReadonlyStoreActions<A>;

export type ReadonlyStoreStateProp = Record<string | number | symbol, any>;

export type ReadonlyStoreState<T extends ReadonlyStoreStateProp> = ToRefsDeepReadOnly<T>;

export type ReadonlyStoreGetters<C extends ReadonlyStoreGetterProp> = {
	[K in keyof C]: ReturnType<C[K]>
}

export type ReadonlyStoreGetterProp = Record<any, (() => any)>

export type ReadonlyStoreActions<A extends ReadonlyStoreActionsProp> = {
	[K in keyof A]: A[K]
}

export type ReadonlyStoreActionsProp = Record<any, ((...args: any[]) => void)>

type StoreContext<T extends ReadonlyStoreStateProp,
	CC extends ReadonlyStoreGetters<C>,
	AA extends ReadonlyStoreActions<A>,
	C extends ReadonlyStoreGetterProp = {},
	A extends ReadonlyStoreActionsProp = {}> =
	T & CC & AA;

function prepareReadonlyState<T extends ReadonlyStoreStateProp>(state: T): ToRefs<DeepReadonly<UnwrapNestedRefs<T>>>
{
	const readOnlyState = toRefs(readonly(state));
	let key: keyof typeof state;
	
	for(key in state)
		readOnlyState[key] = skipHydrate(readOnlyState[key]);
	
	return readOnlyState;
}

function createStoreContext<T extends ReadonlyStoreStateProp,
	C extends ReadonlyStoreGetters<CP>,
	A extends ReadonlyStoreActions<AP>,
	CP extends ReadonlyStoreGetterProp = {},
	AP extends ReadonlyStoreActionsProp = {}>(reactiveState: UnwrapNestedRefs<T>, getters: C, actions: A): T & C & A
{
	const readonlyState = prepareReadonlyState(reactiveState),
		readyReadonlyStore = {...readonlyState, ...getters},
		actionContext : T & C & A = {...reactiveState, ...getters};
	
	let k: keyof A, bindAction;
	for(k in actions)
	{
		bindAction = actions[k].bind(actionContext);
		readyReadonlyStore[k] = actionContext[k] = bindAction
	}
	
	return readyReadonlyStore;
}

export function defineReadonlyStore<Id extends string,
	T extends ReadonlyStoreStateProp,
	TT extends ReadonlyStoreState<T>,
	C extends ReadonlyStoreGetterProp = {},
	A extends ReadonlyStoreActionsProp = {},
	RS = ReadonlyStore<T, C, A>>
(options: ReadonlyStoreOptions<Id, T, C & ThisType<C & TT & A>, A & ThisType<A & TT & ReadonlyStoreGetters<C>>>)
{
	return defineStore(options.id, (): RS =>
	{
		const reactiveState = reactive(options.state() || {});
		
		return createStoreContext(
			reactiveState,
			options.actions ? options.actions(reactiveState) : {},
			options.getters ? options.getters(reactiveState) : {}
		);
	});
}