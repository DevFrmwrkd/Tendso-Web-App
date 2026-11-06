import {createElement,type ReactNode} from 'react';
import PendingPage from '@/app/pending/page';
import type {Doc} from '@/convex/_generated/dataModel';

jest.mock('react',()=>jest.requireActual('../apps/mobile/node_modules/react'));
jest.mock('react/jsx-runtime',()=>jest.requireActual('../apps/mobile/node_modules/react/jsx-runtime'));
jest.mock('react/jsx-dev-runtime',()=>jest.requireActual('../apps/mobile/node_modules/react/jsx-dev-runtime'));
jest.mock('@clerk/nextjs',()=>({useUser:()=>({user:state.signedIn?{id:state.userId}:null,isLoaded:state.loaded,isSignedIn:state.signedIn}),useClerk:()=>({signOut})}));
jest.mock('convex/react',()=>({useQuery:()=>state.creator}));
jest.mock('@/convex/_generated/api',()=>({api:{creators:{getByClerkId:'creator'}}}));
jest.mock('next/navigation',()=>({useRouter:()=>({replace})}));
jest.mock('next/link',()=>({__esModule:true,default:function MockLink({children,...props}:{children?:ReactNode}){return jest.requireActual('../apps/mobile/node_modules/react').createElement('a',props,children);}}));
jest.mock('next/image',()=>({__esModule:true,default:function MockImage(props:Record<string,unknown>){return jest.requireActual('../apps/mobile/node_modules/react').createElement('img',props);}}));
jest.mock('@/components/v2/fonts',()=>({v2Fonts:'sample-onest'}));
jest.mock('@/components/certificate',()=>({useCertificateDownload:()=>({ref:{current:null},download,busy:false})}));

interface Node {type:unknown;props:Record<string,unknown>;children:(Node|string)[];findAllByType(type:string):Node[]}
interface Renderer {root:Node;update(node:ReactNode):void;unmount():void}
const {create,act}=jest.requireActual('../apps/mobile/node_modules/react-test-renderer') as {create(node:ReactNode):Renderer;act(fn:()=>void|Promise<void>):Promise<void>};
const replace=jest.fn(),signOut=jest.fn(async()=>{}),download=jest.fn();
const NOW=Date.UTC(2026,10,6,10);
const creator=():Doc<'creators'>=>({_id:'sample-agent' as Doc<'creators'>['_id'],_creationTime:1,clerkId:'sample-clerk',email:'alex@example.com',firstName:'Alex',lastName:'Rivera',role:'creator',status:'active',balance:0,quizPassedAt:NOW,createdAt:1});
const state:{signedIn:boolean;loaded:boolean;userId:string;creator:Doc<'creators'>|undefined|null}={signedIn:true,loaded:true,userId:'sample-clerk',creator:creator()};
let renderer:Renderer|undefined;
const content=(node:Node|string):string=>typeof node==='string'?node:node.children.map(content).join(' ');
async function mount(){await act(()=>{renderer=create(createElement(PendingPage));});}
async function refresh(){await act(()=>{renderer!.update(createElement(PendingPage));});}
beforeEach(()=>{state.signedIn=true;state.loaded=true;state.userId='sample-clerk';state.creator=creator();replace.mockClear();signOut.mockClear();download.mockClear();});
afterEach(async()=>{if(renderer){await act(()=>renderer!.unmount());renderer=undefined;}});

it('shows the saved quiz and real Tendso notification channel while waiting',async()=>{
  await mount();const text=content(renderer!.root);
  expect(text).toContain('We’re checking your details');expect(text).toContain('Your quiz pass is saved');
  expect(text).toContain('notify you in Tendso');expect(text).not.toMatch(/email you|certificate is on its way/i);
  expect(replace).not.toHaveBeenCalled();
});
it('shows the certificate on live approval, retaining download and dashboard actions',async()=>{
  await mount();state.creator={...state.creator!,certifiedAt:NOW+1000};await refresh();
  expect(content(renderer!.root)).toContain('Certified field agent');expect(content(renderer!.root)).toContain('Alex Rivera');
  expect(replace).not.toHaveBeenCalled();
  expect(renderer!.root.findAllByType('a').some(node=>node.props.href==='/dashboard')).toBe(true);
  const button=renderer!.root.findAllByType('button').find(node=>content(node).includes('Download certificate'))!;
  await act(()=>{(button.props.onClick as ()=>void)();});expect(download).toHaveBeenCalledTimes(1);
});
it('routes a live rejection to the correction flow without clearing the pass',async()=>{
  await mount();state.creator={...state.creator!,rejectedAt:NOW+1000,rejectionReason:'Correct your name.'};await refresh();
  expect(replace).toHaveBeenCalledWith('/verification-rejected');expect(state.creator.quizPassedAt).toBe(NOW);
});
it('does not show the waiting screen to an already approved agent',async()=>{
  state.creator={...creator(),certifiedAt:NOW};await mount();expect(replace).toHaveBeenCalledWith('/dashboard');
  expect(content(renderer!.root)).not.toContain('Your profile is with the team.');
});
it('does not carry the live-approval state across accounts',async()=>{
  await mount();state.userId='other-clerk';state.creator={...creator(),_id:'other-agent' as Doc<'creators'>['_id'],clerkId:'other-clerk',firstName:'Jamie',certifiedAt:NOW};await refresh();
  expect(replace).toHaveBeenCalledWith('/dashboard');expect(content(renderer!.root)).not.toContain('Certified field agent');
});
it.each([['affiliate','/affiliates/dashboard'],['staff','/admin'],['admin','/dashboard']] as const)('keeps the %s role routing',async(role,path)=>{
  state.creator={...creator(),role};await mount();expect(replace).toHaveBeenCalledWith(path);
});
it('routes an agent without a saved pass back to training',async()=>{
  state.creator={...creator(),quizPassedAt:undefined};await mount();expect(replace).toHaveBeenCalledWith('/training');
});
it('routes signed-out users to login without exposing the waiting view',async()=>{
  state.signedIn=false;state.creator=undefined;await mount();expect(replace).toHaveBeenCalledWith('/login');
  expect(content(renderer!.root)).not.toContain('Your profile is with the team.');
});
it.each(['signed-out','loading','other-account'])('hides a retained certificate during %s auth state',async(authState)=>{
  await mount();state.creator={...creator(),certifiedAt:NOW};await refresh();
  expect(content(renderer!.root)).toContain('Certified field agent');replace.mockClear();
  if(authState==='signed-out')state.signedIn=false;
  if(authState==='loading')state.loaded=false;
  if(authState==='other-account')state.userId='other-clerk';
  await refresh();expect(content(renderer!.root)).not.toContain('Certified field agent');
  expect(content(renderer!.root)).not.toContain('Alex Rivera');
  if(authState==='signed-out')expect(replace).toHaveBeenCalledWith('/login');else expect(replace).not.toHaveBeenCalled();
});
