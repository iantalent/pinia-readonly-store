import {defineStore, skipHydrate} from "pinia";
import {computed, ComputedRef, DeepReadonly, reactive, readonly, ToRefs, toRefs, UnwrapNestedRefs} from "vue-demi";

export interface ReadonlyStoreOptions<I extends string, T extends ReadonlyStoreStateProp, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}>
{
	id: I
	state: () => T
	getters?: (state: T) => C // TODO make state independent. just play object of getters
	actions?: (state: T) => A // TODO make state independent. just play object of actions
}

export type ReadonlyStore<T extends ReadonlyStoreStateProp = {}, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}> =
	ReadonlyStoreState<T> & ReadonlyStoreGettersRefs<C> & ReadonlyStoreActions<A>;

export type ReadonlyStoreContext<T extends ReadonlyStoreStateProp = {}, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}> =
	ReadonlyStoreStateReactive<T> & ReadonlyStoreGetters<C> & ReadonlyStoreActions<A>;

export type ReadonlyStoreStateProp = Record<string | number | symbol, any>;

export type ReadonlyStoreState<T extends ReadonlyStoreStateProp> = ToRefs<DeepReadonly<UnwrapNestedRefs<T>>>;

export type ReadonlyStoreStateReactive<T extends ReadonlyStoreStateProp> = UnwrapNestedRefs<T>;

export type ReadonlyStoreGetterProp = Record<string | number | symbol, (() => any)>;

export type ReadonlyStoreGettersRefs<CP extends ReadonlyStoreStateProp> = {
	[K in keyof CP]: ComputedRef<CP[K]>
}

export type ReadonlyStoreGetters<CP extends ReadonlyStoreStateProp> = UnwrapNestedRefs<ReadonlyStoreGettersRefs<CP>>;

export type ReadonlyStoreActionsProp = Record<string | number | symbol, ((...args: any[]) => any)>

export type ReadonlyStoreActions<A extends ReadonlyStoreActionsProp> = {
	[K in keyof A]: A[K]
}

export type ReadonlyStoreActionsContext<A extends ReadonlyStoreActionsProp, X extends ReadonlyStoreContext<any, any, A>> = {
	[K in keyof A]: (this: X, ...args: Parameters<A[K]>) => ReturnType<A[K]>
}

function makeReadonlyReactive<T extends ReadonlyStoreStateProp>(proxy: ReadonlyStoreStateReactive<T>): DeepReadonly<UnwrapNestedRefs<T>>
{
	return readonly(proxy);
}

function prepareReadonlyState<T extends ReadonlyStoreStateProp>(state: ReadonlyStoreStateReactive<T>): ReadonlyStoreState<T>
{
	const readOnlyState = <ReadonlyStoreState<T>>toRefs(makeReadonlyReactive(state));
	let key: keyof typeof state;
	
	for(key in state)
		readOnlyState[key] = skipHydrate(readOnlyState[key]);
	
	return readOnlyState;
}

function addComputedToContext<CP extends ReadonlyStoreGetterProp>(context: ReadonlyStoreContext<any, CP, any>, computed: ReadonlyStoreGettersRefs<CP>)
{
	const unwrappedComputed = reactive(computed);
	
	for(let key in unwrappedComputed)
	{
		if(unwrappedComputed.hasOwnProperty(key))
			context[key] = unwrappedComputed[key];
	}
}

function makeComputed<CP extends ReadonlyStoreGetterProp, XT extends ReadonlyStoreStateProp, XA extends ReadonlyStoreActionsProp>(computedProps: CP, context: ReadonlyStoreContext<XT, CP, XA>): ReadonlyStoreGettersRefs<CP>
{
	const readyComputed = <ReadonlyStoreGettersRefs<CP>>{};
	for(let key in computedProps)
	{
		if(!computedProps.hasOwnProperty(key))
			continue;
		
		readyComputed[key] = computed(computedProps[key].bind(context));
	}
	
	addComputedToContext(context, readyComputed);
	
	return readyComputed;
}

function makeActions<AP extends ReadonlyStoreActionsProp>(actionsProps: AP, context: ReadonlyStoreContext<any, any, AP>): ReadonlyStoreActions<AP>
{
	const readyActions = <ReadonlyStoreActions<AP>>{};
	let key: keyof AP;
	for(key in actionsProps)
	{
		if(!actionsProps.hasOwnProperty(key))
			continue;
		
		const bindAction = <AP[keyof AP]>actionsProps[key].bind(context);
		actionsProps[key] = bindAction;
		context[key] = bindAction;
	}
	return readyActions;
}

type MakeStoreOptions<C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}> = {
	computed?: C,
	actions?: A
}

type ExtractStoreGettersProp<T extends MakeStoreOptions> = T extends MakeStoreOptions<infer C , any> ? C : never;
type ExtractStoreActionsProp<T extends MakeStoreOptions> = T extends MakeStoreOptions<any, infer A> ? A : never;

function makeStore<TT extends ReadonlyStoreStateReactive<TP>,
	TR extends ReadonlyStoreState<TP>,
	C extends ReadonlyStoreGetters<CP>,
	A extends ReadonlyStoreActions<AP>,
	O extends MakeStoreOptions,
	CP extends ExtractStoreGettersProp<O>,
	AP extends ExtractStoreActionsProp<O>,
	TP extends ReadonlyStoreStateProp = {},
	X = ReadonlyStoreContext<TP, CP, AP>>(readonlyState: TR, reactiveState: TT, options: O): TR & ReadonlyStoreGettersRefs<CP> & ReadonlyStoreActions<AP>
{
	const context = <ReadonlyStoreContext<TP, CP, AP>>{...readonlyState};
	const readyComputed = options.computed ? makeComputed(options.computed, context) : {};
	const readyActions = options.actions ? makeActions(options.actions, context) : {};
	
	return {...readonlyState, ...readyComputed, ...readyActions};
}

export function defineReadonlyStore<Id extends string,
	TT extends ReadonlyStoreState<T>,
	T extends ReadonlyStoreStateProp = {},
	C extends ReadonlyStoreGetterProp = {},
	A extends ReadonlyStoreActionsProp = {},
	RS = ReadonlyStore<T, C, A>>
(options: ReadonlyStoreOptions<Id, T, C & ThisType<C & TT & A>, A & ThisType<A & TT & ReadonlyStoreGetters<C>>>)
{
	return defineStore(options.id, (): ReadonlyStore<T, C, A> =>
	{
		const initialState = options.state() || {},
			reactiveState = reactive(initialState),
			readOnlyState = prepareReadonlyState(reactiveState),
			makeOptions = <MakeStoreOptions<C, A>>{};
		
		if(options.getters)
			makeOptions.computed = options.getters(reactiveState);
		
		if(options.actions)
			makeOptions.actions = options.actions(reactiveState);
		
		return makeStore(readOnlyState, reactiveState, options);
	});
}